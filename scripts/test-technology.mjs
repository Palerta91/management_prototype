import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root=new URL('../dist/assets/',import.meta.url);
const source=file=>readFileSync(new URL(file,root),'utf8');
const core=source('app.js').split("document.addEventListener('click',event=>")[0];
let stored=null;
const elements=new Map();
const context=vm.createContext({structuredClone,console,URL,Blob,setTimeout,clearTimeout,
  localStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value;}},
  document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,close(){},focus(){}});return elements.get(id);}}
});
for(const file of ['seed.js','technology.js'])vm.runInContext(source(file),context,{filename:file});
vm.runInContext(core,context,{filename:'app.js'});
vm.runInContext('render=()=>{};notify=()=>{};closeDrawer=()=>{};openComponent=()=>{};openTechRequest=()=>{};',context);
const run=code=>vm.runInContext(code,context);
const form=(id,values)=>elements.set(id,{reportValidity:()=>true,elements:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value:String(value),focus(){}}]))});
const event={preventDefault(){}};context.testEvent=event;

assert.equal(run('techComponents.length'),16);
assert.equal(run('techRequests.length'),1);
assert.equal(run("tasks.filter(t=>t.techRequestId==='request-demo-board').length"),1);
assert.equal(run("techComponents.filter(c=>c.project==='aurora'&&componentHealth(c).kind==='good').length"),2);
assert.equal(run("techComponents.filter(c=>c.project==='aurora'&&componentHealth(c).kind==='risk').length"),2);
assert.equal(run('techComponents.every(validTechComponent)'),true);
const financialBefore=run('JSON.stringify(totals())');
run("scope='aurora';techProject='aurora';persist();");
const projectFinance=run('JSON.stringify(totals())');

form('techRequestForm',{quantity:48,unitPrice:250,currency:'USD',rate:92,cost:0,owner:'team-3',due:'2026-10-20',reason:'Поставка 48 жгутов для сборки',criteria:'Входной контроль по спецификации',document:'PR-119'});
run("requestComponent='a-harness';requestType='purchase';saveTechRequest(testEvent);");
assert.equal(run("techRequests.find(r=>r.type==='purchase').cost"),1104000);
assert.equal(run("tasks.find(t=>t.code==='PR-TC-001').plan"),1104);
assert.equal(run("tasks.find(t=>t.code==='PR-TC-001').stage"),'approval');
assert.equal(run("techComponents.find(c=>c.id==='a-harness').stock"),0);
assert.equal(run('JSON.stringify(totals())'),projectFinance);
// Duplicate requests for the same component/revision cannot be created.
run('saveTechRequest(testEvent);');assert.equal(run("techRequests.filter(r=>r.type==='purchase').length"),1);
// An RUB conversion rate other than 1 is rejected.
form('techRequestForm',{quantity:1,unitPrice:5,currency:'RUB',rate:2,cost:0,owner:'team-3',due:'2026-10-20',reason:'Проверка',criteria:'Контроль',document:'SPEC'});
run("requestComponent='a-sensor';saveTechRequest(testEvent);");assert.equal(run("techRequests.filter(r=>r.type==='purchase').length"),1);

form('componentForm',{code:'PCB-04',revision:'Rev E',name:'Плата управления',group:'Силовая электроника',perUnit:1,spec:'Новая топология',reason:'Снижение наводок',document:'CR-10'});
run("editingComponent='a-board';saveComponent(testEvent);");
assert.equal(run("techRequests.find(r=>r.id==='request-demo-board').status"),'outdated');
assert.equal(run("tasks.find(t=>t.id==='task-tech-demo-board').superseded"),true);
assert.equal(run("tasks.find(t=>t.id==='task-tech-demo-board').stage"),'decision');
assert.equal(run("techComponents.find(c=>c.id==='a-board').stock"),24);
assert.equal(run("usableStock(techComponents.find(c=>c.id==='a-board'))"),0);
assert.equal(run("techEvents.find(e=>e.type==='revision'&&e.after?.revision==='Rev E').before.revision"),'Rev D');
assert.equal(run('JSON.stringify(totals())'),projectFinance);

form('techRequestForm',{quantity:1,unitPrice:1,currency:'RUB',rate:1,cost:1800,owner:'team-1',due:'2026-10-22',reason:'Проверить Rev E',criteria:'Погрешность 0,5%',document:'CR-10'});
run("requestComponent='a-board';requestType='verification';saveTechRequest(testEvent);");
assert.equal(run("techComponents.find(c=>c.id==='a-board').verification"),'pending');
const frozen=run('snapshot()');
form('verificationResultForm',{result:'passed',document:'TEST-28-E',conclusion:'Все критерии пройдены'});
run("resultRequest=techRequests.find(r=>r.componentId==='a-board'&&r.revision==='Rev E').id;saveVerificationResult(testEvent);");
assert.equal(run("techComponents.find(c=>c.id==='a-board').verification"),'passed');
// A successful test cannot reclassify stock from an older revision.
assert.equal(run("componentHealth(techComponents.find(c=>c.id==='a-board')).kind"),'risk');
assert.equal(frozen.technology.components.find(c=>c.id==='a-board').verification,'pending');
assert.equal(frozen.technology.requests.find(r=>r.revision==='Rev E').status,'pending');

// Failed results remain a blocker, even if all inventory is present.
run("techComponents.find(c=>c.id==='a-board').stockRevision='Rev E';");
form('techRequestForm',{quantity:1,unitPrice:1,currency:'RUB',rate:1,cost:0,owner:'team-1',due:'2026-10-23',reason:'Повторная проверка',criteria:'EMC',document:'CR-10'});
run("requestComponent='a-board';requestType='verification';saveTechRequest(testEvent);");
form('verificationResultForm',{result:'failed',document:'TEST-29-E',conclusion:'Обнаружено отклонение EMC'});
run("resultRequest=techRequests.filter(r=>r.componentId==='a-board'&&r.status==='pending').at(-1).id;saveVerificationResult(testEvent);");
assert.equal(run("componentHealth(techComponents.find(c=>c.id==='a-board')).kind"),'risk');
assert.equal(run("tasks.find(t=>t.techRequestId===resultRequest).stage"),'decision');

// Changing revision marks a procurement request for review without silently cancelling it.
form('componentForm',{code:'CB-M',revision:'Rev B',name:'Кабельный жгут серии M',group:'Механика и сборка',perUnit:2,spec:'Разъём новой серии',reason:'Повысить надёжность',document:'CR-11'});
run("editingComponent='a-harness';saveComponent(testEvent);");
assert.equal(run("techRequests.find(r=>r.type==='purchase').status"),'needsReview');
assert.equal(run("tasks.find(t=>t.code==='PR-TC-001').stage"),'decision');
assert.equal(run("tasks.find(t=>t.code==='PR-TC-001').superseded"),false);
// New positions require both inventory and verification.
form('componentForm',{code:'FAN-01',revision:'Rev A',name:'Вентилятор',group:'Механика',perUnit:1,spec:'12 V',reason:'Дополнительное охлаждение',document:'CR-12'});
run('editingComponent=null;saveComponent(testEvent);');assert.equal(run("componentHealth(techComponents.find(c=>c.code==='FAN-01')).kind"),'risk');

run('persist();');const taskCount=run('tasks.length'),requestCount=run('techRequests.length');
run('initializeTechnology(JSON.parse(localStorage.getItem(storageKey)));');
assert.equal(run('tasks.length'),taskCount);assert.equal(run('techRequests.length'),requestCount);
assert.equal(run('techComponents.every(validTechComponent)'),true);
assert.equal(run('JSON.stringify(totals())'),projectFinance);
run("scope='all';");assert.equal(run('JSON.stringify(totals())'),financialBefore);
assert.equal(run("csvCell('=HYPERLINK(1)')").startsWith('"\''),true);
// Exercise existing Word/Excel export builders without downloading anything.
context.document.body={append(){}};
context.document.createElement=()=>({click(){},remove(){}});
context.URL={createObjectURL:blob=>{context.exportedBlob=blob;return 'blob:test';},revokeObjectURL(){}};
run("downloadReport(snapshot(),'excel','test');");
const csv=await context.exportedBlob.text();
assert.ok(csv.includes('ТЕХНОЛОГИЧЕСКАЯ КАРТА'));assert.ok(csv.includes('ЗАПРОСЫ КОМПОНЕНТОВ'));assert.ok(csv.includes('ИСТОРИЯ СОСТАВА'));assert.ok(csv.includes('CR-10'));
assert.ok(csv.includes('"План";"2880"'));
assert.ok(csv.includes('"Оценка, тыс. руб."'));
assert.ok(csv.includes('"1104"'));
assert.equal(/EUR|€|млн/.test(csv),false);
assert.equal(run('csvCell(-8.7)'), '"-8,7"');
run("downloadReport(snapshot(),'word','test');");
const word=await context.exportedBlob.text();assert.ok(word.includes('Технологическая карта'));assert.ok(word.includes('Обоснования изменений'));assert.ok(word.includes('Вентилятор'));
assert.ok(word.includes('2 880 тыс. руб.'));
assert.ok(word.includes('оценка 1,8 тыс. руб.'));
assert.equal(/EUR|€|млн/.test(word),false);
run("downloadReport(snapshot(),'json','test');");
const json=JSON.parse(await context.exportedBlob.text());
assert.equal(json.technology.components.length,17);
assert.equal(json.currency,'RUB');assert.equal(json.financialUnit,'тыс. руб.');
assert.equal(json.requestCostUnit,'тыс. руб.');assert.equal(json.componentPriceUnit,'тыс. руб.');
assert.equal(json.totals.base,2880);
assert.equal(json.technology.requests.find(r=>r.type==='purchase').cost,1104);
assert.equal(json.technology.requests.find(r=>r.type==='purchase').unitPrice,23);
assert.equal(json.technology.requests.find(r=>r.type==='purchase').quotedCurrency,'USD');
assert.equal(json.technology.components.find(c=>c.id==='a-sensor').unitPrice,0.07667);
assert.equal(run("techRequests.find(r=>r.type==='purchase').cost"),1104000);

// Relabelling existing demo state must not drop edits or rescale saved numbers.
run("const legacyState=JSON.parse(localStorage.getItem(storageKey));legacyState.technology.components.find(c=>c.code==='FAN-01').currency='EUR';initializeTechnology(legacyState);");
assert.equal(run("techComponents.find(c=>c.code==='FAN-01').currency"),'RUB');
assert.equal(run('techComponents.length'),17);assert.equal(run('techRequests.length'),requestCount);
assert.equal(run("normalizeRubDemoData({amount:12,currency:'EUR',label:'−€ 12K',url:'https://example.test/?currency=EUR'}).label"),'−12 тыс. ₽');
assert.equal(run("normalizeRubDemoData({amount:12,currency:'EUR'}).amount"),12);
assert.equal(run("normalizeRubDemoData({url:'https://example.test/?currency=EUR'}).url"),'https://example.test/?currency=EUR');
run("const legacyReport=structuredClone(snapshot());legacyReport.currency='EUR';legacyReport.technology.components.find(c=>c.id==='a-sensor').currency='EUR';downloadReport(legacyReport,'json','legacy');");
const legacyJson=JSON.parse(await context.exportedBlob.text());
assert.equal(legacyJson.currency,'RUB');assert.equal(legacyJson.technology.components.find(c=>c.id==='a-sensor').unitPrice,0.07667);
assert.equal(run("legacyReport.technology.components.find(c=>c.id==='a-sensor').currency"),'EUR');
assert.equal(/userSummary|users-summary/.test(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8')),false);
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const assetUrls=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
assert.equal(assetUrls.length,6);
assert.ok(assetUrls.every(url=>url.endsWith('?v=20261004-rub2')));
const nginx=readFileSync(new URL('../deploy/nginx.conf',import.meta.url),'utf8');
assert.ok(nginx.includes('add_header Cache-Control "no-store" always;'));
console.log('Tests passed: component workflow, RUB budgets and FX, thousand-ruble reports, legacy migration, immutable history, removed user summary and fresh release assets.');
