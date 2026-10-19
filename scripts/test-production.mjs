import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const elements=new Map();let stored=null;
const getElement=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,innerHTML:'',textContent:'',close(){},showModal(){}});return elements.get(id);};
const ctx=vm.createContext({structuredClone,console,URL,Blob,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>stored,setItem:(_k,v)=>{stored=v;}},document:{getElementById:getElement,body:{append(){}},createElement:()=>({click(){},remove(){}})}});
const source=file=>readFileSync(new URL('../dist/assets/'+file,import.meta.url),'utf8');
for(const file of ['seed.js','technology.js','production.js'])vm.runInContext(source(file),ctx,{filename:file});
vm.runInContext(source('app.js').split("document.addEventListener('click',event=>")[0],ctx,{filename:'app.js'});
const run=code=>vm.runInContext(code,ctx);
run('notify=()=>{};renderProduction=()=>{};renderReports=()=>{};');
const form=(id,values)=>elements.set(id,{reportValidity:()=>true,elements:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:String(v)}]))});
ctx.event={preventDefault(){}};
const baselineFinance=run('JSON.stringify(projectIds.map(financial))');
const baselineTasks=run('tasks.length');
const summary=run('productionSummary()');
assert.equal(summary.checked,106);assert.equal(summary.good,101);assert.equal(summary.bad,5);
assert.equal(summary.shipped,50);assert.equal(summary.available,73);
assert.equal(summary.supplierChecked,356);assert.equal(summary.supplierBad,19);
assert.ok(Math.abs(summary.paid-276.82)<0.00001);
assert.equal(run("productionPurchases().some(p=>p.id==='PR-119')"),false);
assert.equal(run('productionPercent(0,0)'),'—');
assert.equal(run("validProductionDate('2026-02-30')"),false);
assert.equal(run("productionShipmentStatus(productionData.shipments.find(s=>s.id==='ship-a-03')).label"),'Просрочено');
// Each project's stock reconciles with all accepted releases and actual shipments.
run("scope='aurora';");assert.equal(run('productionSummary().good'),41);assert.equal(run('productionSummary().shipped'),16);assert.equal(run('productionSummary().available'),29);
assert.equal(run('productionSummary().supplierBad'),0);
run("scope='orbit';");assert.equal(run('productionSummary().bad'),1);assert.equal(run('productionSummary().supplierBad'),12);
run("scope='nova';");assert.equal(run('productionSummary().good'),25);assert.equal(run('productionSummary().supplierBad'),7);
run("scope='all';setProductionRange('week');");assert.equal(run('productionData.from'),'2026-10-13');assert.equal(run('productionSummary().good'),45);
run("setProductionRange('day');");assert.equal(run('productionSummary().good'),18);assert.equal(run('productionSummary().paid'),0);
run("setProductionRange('quarter');");assert.equal(run('productionData.from'),'2026-10-01');
run("productionData.from='2026-09-01';");assert.equal(run('productionSummary().supplierBad'),60);assert.equal(run('productionSummary().supplierChecked'),596);
// Bucket sums equal the headline metrics, for any interval granularity.
for(const group of ['day','week','month']){
  run(`productionData.group='${group}';`);
  assert.equal(run('productionBuckets().reduce((s,b)=>s+b.good,0)'),run('productionSummary().good'));
  assert.equal(run('productionBuckets().reduce((s,b)=>s+b.bad,0)'),run('productionSummary().bad'));
  assert.equal(run('productionBuckets().reduce((s,b)=>s+b.shipped,0)'),run('productionSummary().shipped'));
}
run("setProductionRange('month');scope='aurora';");
const stateBefore=run('snapshot()');
// Register a new batch; reject duplicates, fractional quantities and invalid dates.
const newRun={project:'aurora',date:'2026-10-19',code:'A-TEST',revision:'Rev C',checked:5,document:'ОТК-TEST'};
form('productionRunForm',newRun);run('saveProductionRun(event);');assert.equal(run('productionSummary().good'),46);
const runCount=run('productionData.runs.length');run('saveProductionRun(event);');assert.equal(run('productionData.runs.length'),runCount);
form('productionRunForm',{...newRun,code:'FRACTION',checked:1.5});run('saveProductionRun(event);');assert.equal(run('productionData.runs.length'),runCount);
form('productionRunForm',{...newRun,code:'FUTURE',date:'2026-10-20'});run('saveProductionRun(event);');assert.equal(run('productionData.runs.length'),runCount);
const runId=run("productionData.runs.find(r=>r.code==='A-TEST').id");
const defect={source:'production',project:'aurora',batchId:runId,date:'2026-10-19',quantity:2,cost:12345,reason:'Тестовый дефект изоляции',document:'АКТ-TEST',owner:'ОТК',action:'Изолировать и выполнить анализ'};
form('productionDefectForm',defect);run('saveProductionDefect(event);');assert.equal(run('productionSummary().good'),44);assert.equal(run('productionSummary().bad'),5);
assert.equal(run("productionData.defects.find(d=>d.document==='АКТ-TEST').cost"),12.345);
const defectCount=run('productionData.defects.length');
run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount);
form('productionDefectForm',{...defect,document:'OVER',quantity:4});run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount);
form('productionDefectForm',{...defect,document:'CROSS',project:'orbit'});run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount);
form('productionDefectForm',{...defect,document:'EARLY',date:'2026-10-18'});run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount);
// Stock safety checks include intermediate shipment dates, not just today's balance.
const oldRunId=run("productionData.runs.find(r=>r.code==='A-0924').id");
form('productionDefectForm',{...defect,batchId:oldRunId,date:'2026-09-24',quantity:8,document:'ALREADY-SHIPPED'});run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount);
// Supplier acts use inspected components, not the order's undelivered quantity.
form('productionDefectForm',{...defect,source:'supplier',batchId:'PO-287',quantity:61,document:'UNDELIVERED'});run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount);
form('productionDefectForm',{...defect,source:'supplier',batchId:'PO-287',quantity:2,document:'SUP-TEST'});run('saveProductionDefect(event);');assert.equal(run('productionData.defects.length'),defectCount+1);assert.equal(run('productionSummary().supplierBad'),2);
// Closing an act retains quantity/loss, history and the immutable report snapshot.
const defectId=run("productionData.defects.find(d=>d.document==='АКТ-TEST').id");
const beforeReview=run('productionSnapshot()');
form('productionReviewForm',{defectId,status:'closed',reason:'Повторная проверка завершена; факт брака сохраняется',action:'Списание по акту'});
run('saveProductionDefectReview(event);');assert.equal(run('productionSummary().bad'),5);
assert.equal(run("productionData.defects.find(d=>d.document==='АКТ-TEST').events.length"),1);
assert.equal(beforeReview.defects.find(d=>d.id===defectId).status,'open');
assert.equal(stateBefore.production.summary.good,41);
// An actual shipment changes available stock, not output. Repeated submission is rejected.
form('productionShipmentForm',{shipmentId:'ship-a-03',date:'2026-10-19',document:'УПД-TEST',reason:'Протокол ОТК: изоляция соответствует'});
const stockBefore=run('productionAvailable("aurora")');run('saveProductionShipment(event);');assert.equal(run('productionAvailable("aurora")'),stockBefore-12);assert.equal(run('productionSummary().shipped'),28);
run('saveProductionShipment(event);');assert.equal(run('productionAvailable("aurora")'),stockBefore-12);
form('productionShipmentForm',{shipmentId:'ship-a-04',date:'2026-09-24',document:'EARLY-SHIP',reason:'Тест проверки остатков'});run('saveProductionShipment(event);');
assert.equal(run("productionData.shipments.find(s=>s.id==='ship-a-04').shippedAt"),null);
assert.equal(run('JSON.stringify(projectIds.map(financial))'),baselineFinance);
assert.equal(run('tasks.length'),baselineTasks);
// Persistence must retain all ledgers and existing workspace data without reseeding duplicates.
run('persist();');const persisted=JSON.parse(stored);assert.equal(persisted.production.runs.length,runCount);assert.ok(persisted.technology);assert.ok(persisted.users.length);
run('initializeProduction(JSON.parse(localStorage.getItem(storageKey)));');assert.equal(run('productionData.runs.length'),runCount);assert.equal(run('productionData.defects.length'),defectCount+1);
run("const malformed=structuredClone(productionData);malformed.from='1900-01-01';initializeProduction({production:malformed});");assert.equal(run('productionData.from'),'2026-10-01');
// Source-specific exports cannot leak the other defect category; sums stay in thousand RUB.
ctx.URL={createObjectURL:blob=>{ctx.blob=blob;return 'blob:test';},revokeObjectURL(){}};
run("const productionReport=snapshot();productionReport.reportKind='production';productionReport.production=productionSnapshot('production');downloadReport(productionReport,'excel','test');");
const csv=await ctx.blob.text();assert.ok(csv.includes('12,345'));assert.ok(csv.includes('тыс. руб.'));assert.ok(csv.includes('АКТ-TEST'));assert.equal(csv.includes('SUP-TEST'),false);assert.equal(/EUR|€|млн/.test(csv),false);
run("downloadReport(productionReport,'word','test');");const word=await ctx.blob.text();assert.ok(word.includes('12,35 тыс. руб.'));assert.ok(word.includes('Списание по акту'));assert.equal(word.includes('SUP-TEST'),false);
run("downloadReport(productionReport,'json','test');");const json=JSON.parse(await ctx.blob.text());assert.equal(json.financialUnit,'тыс. руб.');assert.equal(json.production.defects.every(d=>d.source==='production'),true);assert.equal(json.production.defects.find(d=>d.document==='АКТ-TEST').cost,12.345);
run("productionReport.production=productionSnapshot('supplier');downloadReport(productionReport,'excel','test');");const supplierCsv=await ctx.blob.text();assert.ok(supplierCsv.includes('SUP-TEST'));assert.equal(supplierCsv.includes('АКТ-TEST'),false);
// Older reports remain downloadable and new general reports include production.
run("const oldReport=snapshot();delete oldReport.production;downloadReport(oldReport,'excel','old');");assert.ok((await ctx.blob.text()).includes('КАРТОЧКИ'));
run("downloadReport(snapshot(),'excel','full');");assert.ok((await ctx.blob.text()).includes('ПРОИЗВОДСТВО'));
console.log('Tests passed: production cohorts, period filters, charts, project scope, supplier/production defects, stock safety, audit trail, persistence and Word/CSV/JSON thousand-RUB exports.');
