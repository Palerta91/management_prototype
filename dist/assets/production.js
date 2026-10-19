'use strict';

// A separate operational ledger: quantities are units, money is thousand RUB.
const productionAsOf='2026-10-19';
const productionSources={production:'Производство',supplier:'Поставщик'};
const productionDefectStatuses={open:'Открыт',review:'Разбор причин',rework:'Корректирующие действия',closed:'Закрыт'};
const productionPurchaseFacts={
  'PR-104':{date:'2026-09-29',supplier:'Сенсорика',checked:240,paid:18.4,document:'УПД-104 / LOT-032'},
  'PO-287':{date:'2026-10-08',supplier:'Power Components',checked:60,paid:55.62,document:'INV-287 / LOT-041'},
  'PO-301':{date:'2026-10-02',supplier:'Термотех',checked:28,paid:44.9,document:'УПД-301 / LOT-039'},
  'PO-408':{date:'2026-10-05',supplier:'Плата-Сервис',checked:120,paid:38.6,document:'УПД-408 / LOT-055'},
  'PR-206':{date:'2026-10-12',supplier:'Navigation Systems',checked:40,paid:26.2,document:'INV-412 / LOT-056'},
  'PO-510':{date:'2026-10-01',supplier:'Спектр',checked:32,paid:84.2,document:'УПД-510 / LOT-061'},
  'PO-516':{date:'2026-10-14',supplier:'Оптик-Тех',checked:76,paid:27.3,document:'УПД-516 / LOT-064'}
};
let productionData;
function productionSeed() {
  return {version:1,range:'month',from:'2026-10-01',to:productionAsOf,group:'week',source:'all',
    runs:[
      ['run-a-01','aurora','A-0924','2026-09-24',12,'Rev C'],['run-a-02','aurora','A-1002','2026-10-02',10,'Rev C'],['run-a-03','aurora','A-1008','2026-10-08',12,'Rev C'],['run-a-04','aurora','A-1015','2026-10-15',14,'Rev C'],['run-a-05','aurora','A-1019','2026-10-19',8,'Rev C'],
      ['run-o-01','orbit','O-0928','2026-09-28',10,'Rev B'],['run-o-02','orbit','O-1005','2026-10-05',12,'Rev B'],['run-o-03','orbit','O-1012','2026-10-12',14,'Rev B'],['run-o-04','orbit','O-1019','2026-10-19',10,'Rev B'],
      ['run-n-01','nova','N-0930','2026-09-30',8,'Rev A'],['run-n-02','nova','N-1006','2026-10-06',10,'Rev A'],['run-n-03','nova','N-1016','2026-10-16',16,'Rev A']
    ].map(([id,project,code,date,checked,revision])=>({id,project,code,date,checked,revision,document:'ОТК-'+code})),
    shipments:[
      ['ship-a-01','aurora',8,'2026-09-28','2026-09-28','УПД-А-01',''],['ship-a-02','aurora',16,'2026-10-09','2026-10-09','УПД-А-02',''],['ship-a-03','aurora',12,'2026-10-16',null,'ЗАК-А-03','Повторный контроль изоляции партии A-1015'],['ship-a-04','aurora',8,'2026-10-26',null,'ЗАК-А-04',''],
      ['ship-o-01','orbit',8,'2026-10-01','2026-10-01','УПД-О-01',''],['ship-o-02','orbit',12,'2026-10-13','2026-10-13','УПД-О-02',''],['ship-o-03','orbit',10,'2026-10-23',null,'ЗАК-О-03',''],
      ['ship-n-01','nova',6,'2026-10-02','2026-10-02','УПД-Н-01',''],['ship-n-02','nova',8,'2026-10-09','2026-10-09','УПД-Н-02',''],['ship-n-03','nova',12,'2026-10-28',null,'ЗАК-Н-03','Контроль соосности перед упаковкой']
    ].map(([id,project,quantity,due,shippedAt,document,blocker])=>({id,project,quantity,due,shippedAt,document,blocker})),
    defects:[
      ['def-a-s','supplier','aurora','PR-104','2026-09-29',41,3.14347,'Дрейф температурных датчиков выше допуска','АКТ-S-032','review'],
      ['def-o-s','supplier','orbit','PO-408','2026-10-05',12,3.86,'Несоответствие проводников платы','АКТ-S-055','rework'],
      ['def-n-s','supplier','nova','PO-516','2026-10-14',7,2.51447,'Отслоение покрытия оптического окна','АКТ-S-064','open'],
      ['def-a-p1','production','aurora','run-a-02','2026-10-02',1,4.8,'Нестабильность выходного напряжения','АКТ-P-002','closed'],
      ['def-a-p2','production','aurora','run-a-04','2026-10-15',2,9.6,'Отклонение сопротивления изоляции','АКТ-P-015','review'],
      ['def-o-p','production','orbit','run-o-03','2026-10-12',1,3.2,'Ошибка калибровки навигационного канала','АКТ-P-012','rework'],
      ['def-n-p','production','nova','run-n-03','2026-10-16',1,5.4,'Нарушение соосности оптического тракта','АКТ-P-016','open']
    ].map(([id,source,project,batchId,date,quantity,cost,reason,document,status])=>({id,source,project,batchId,date,quantity,cost,reason,document,status,action:source==='supplier'?'Рекламация поставщику; ожидается замена.':'Изолировать изделия; провести анализ причины.',owner:'ОТК',events:[]}))
  };
}
function validProductionDate(value) {return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function initializeProduction(savedState) {
  const state=savedState.production;
  productionData=productionSeed();
  if(!state||state.version!==1)return;
  for(const key of ['runs','shipments','defects'])if(Array.isArray(state[key]))productionData[key]=state[key].filter(item=>item&&typeof item.id==='string'&&/^[\w-]+$/.test(item.id)&&projectIds.includes(item.project));
  productionData.runs=productionData.runs.filter(r=>validProductionDate(r.date)&&Number.isInteger(r.checked)&&r.checked>0&&r.checked<=1000000&&['code','revision','document'].every(k=>typeof r[k]==='string'));
  productionData.shipments=productionData.shipments.filter(s=>validProductionDate(s.due)&&(!s.shippedAt||validProductionDate(s.shippedAt))&&Number.isInteger(s.quantity)&&s.quantity>0&&typeof s.document==='string');
  productionData.defects=productionData.defects.filter(d=>d.source in productionSources&&d.status in productionDefectStatuses&&validProductionDate(d.date)&&Number.isInteger(d.quantity)&&d.quantity>0&&Number.isFinite(d.cost)&&d.cost>=0&&['reason','document','action','owner'].every(k=>typeof d[k]==='string')&&productionBatch(d.source,d.batchId)?.project===d.project);
  for(const key of ['from','to'])if(validProductionDate(state[key]))productionData[key]=state[key];
  if(productionData.from>productionData.to||productionData.to>productionAsOf||Date.parse(productionData.to)-Date.parse(productionData.from)>366*86400000){productionData.from='2026-10-01';productionData.to=productionAsOf;}
  if(['day','week','month','quarter','custom'].includes(state.range))productionData.range=state.range;
  if(['day','week','month'].includes(state.group))productionData.group=state.group;
  if(state.source==='all'||state.source in productionSources)productionData.source=state.source;
}
function productionPurchases() {return purchases.filter(p=>productionPurchaseFacts[p.id]).map(p=>({...p,...productionPurchaseFacts[p.id]}));}
function productionBatch(source,id) {return source==='production'?productionData.runs.find(r=>r.id===id):productionPurchases().find(p=>p.id===id);}
function productionBatchName(source,batch) {return source==='production'?batch.code+' · '+batch.revision:batch.id+' · '+batch.component;}
function productionInRange(date,from=productionData.from,to=productionData.to) {return date>=from&&date<=to;}
function productionRejects(source,id,to=productionData.to) {return productionData.defects.filter(d=>d.source===source&&d.batchId===id&&d.date<=to).reduce((s,d)=>s+d.quantity,0);}
function productionGood(run,to=productionData.to) {return Math.max(0,run.checked-productionRejects('production',run.id,to));}
function productionAvailable(project,date=productionData.to) {return productionData.runs.filter(r=>r.project===project&&r.date<=date).reduce((s,r)=>s+productionGood(r,date),0)-productionData.shipments.filter(s=>s.project===project&&s.shippedAt&&s.shippedAt<=date).reduce((s,r)=>s+r.quantity,0);}
function productionPercent(bad,total) {return total?number(bad/total*100)+'%':'—';}
function productionShipmentStatus(s,asOf=productionData.to) {
  if(s.shippedAt&&s.shippedAt<=asOf)return {label:'Отгружено',kind:'good'};
  if(s.due<asOf)return {label:'Просрочено',kind:'risk'};
  if(s.blocker)return {label:'Блокер',kind:'warning'};
  return {label:'Запланировано',kind:'neutral'};
}
function productionSummary(ids=scopeIds(),from=productionData.from,to=productionData.to) {
  const runs=productionData.runs.filter(r=>ids.includes(r.project)&&productionInRange(r.date,from,to)),orders=productionPurchases().filter(p=>ids.includes(p.project)&&productionInRange(p.date,from,to));
  const checked=runs.reduce((s,r)=>s+r.checked,0),bad=runs.reduce((s,r)=>s+productionRejects('production',r.id,to),0),supplierChecked=orders.reduce((s,p)=>s+p.checked,0),supplierBad=orders.reduce((s,p)=>s+productionRejects('supplier',p.id,to),0);
  const shipments=productionData.shipments.filter(s=>ids.includes(s.project));
  return {checked,bad,good:checked-bad,supplierChecked,supplierBad,shipped:shipments.filter(s=>s.shippedAt&&productionInRange(s.shippedAt,from,to)).reduce((n,s)=>n+s.quantity,0),available:ids.reduce((s,id)=>s+productionAvailable(id,to),0),paid:orders.reduce((s,p)=>s+p.paid,0),ordered:orders.reduce((s,p)=>s+p.amount,0),overdue:shipments.filter(s=>productionShipmentStatus(s,to).kind==='risk').length,blocked:shipments.filter(s=>(!s.shippedAt||s.shippedAt>to)&&s.blocker).length};
}
function productionBuckets() {
  const buckets=new Map();
  for(let date=productionData.from;date<=productionData.to;){
    const d=new Date(date+'T00:00:00Z');let key=date;
    if(productionData.group==='week'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));key=d.toISOString().slice(0,10);}
    if(productionData.group==='month')key=date.slice(0,7)+'-01';
    if(!buckets.has(key))buckets.set(key,{key,good:0,bad:0,shipped:0});
    const next=new Date(date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10);
  }
  const keyFor=date=>{const d=new Date(date+'T00:00:00Z');if(productionData.group==='month')return date.slice(0,7)+'-01';if(productionData.group==='week')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
  productionData.runs.filter(inScope).filter(r=>productionInRange(r.date)).forEach(r=>{const b=buckets.get(keyFor(r.date));b.good+=productionGood(r);b.bad+=productionRejects('production',r.id);});
  productionData.shipments.filter(inScope).filter(s=>s.shippedAt&&productionInRange(s.shippedAt)).forEach(s=>buckets.get(keyFor(s.shippedAt)).shipped+=s.quantity);
  return [...buckets.values()];
}
function productionSnapshot(source='all') {
  const from=productionData.from,to=productionData.to;
  return structuredClone({asOf:productionAsOf,from,to,financialUnit:'тыс. руб.',source,summary:productionSummary(),runs:productionData.runs.filter(inScope).filter(r=>productionInRange(r.date)).map(r=>({...r,good:productionGood(r),defect:productionRejects('production',r.id)})),shipments:productionData.shipments.filter(inScope).map(s=>({...s,status:productionShipmentStatus(s).label})),purchases:productionPurchases().filter(inScope).filter(p=>productionInRange(p.date)).map(p=>({...p,defect:productionRejects('supplier',p.id)})),defects:productionData.defects.filter(inScope).filter(d=>productionInRange(d.date)&&(source==='all'||source===d.source)).map(d=>({...d,batchName:productionBatchName(d.source,productionBatch(d.source,d.batchId))})),buckets:productionBuckets(),projects:scopeIds().map(id=>({id,...productionSummary([id])}))});
}
function renderProduction() {
  const s=productionSummary(),from=productionData.from,to=productionData.to;
  $('productionRange').value=productionData.range;$('productionFrom').value=from;$('productionTo').value=to;$('productionGroup').value=productionData.group;$('productionSource').value=productionData.source;
  $('productionPeriodLabel').textContent=displayDate(from)+' — '+displayDate(to);
  $('productionMetrics').innerHTML=[metric('Выпущено годных',number(s.good)+' ед.','Проверено '+number(s.checked)+' изделий','accent'),metric('Отгружено за период',number(s.shipped)+' ед.','По документам отгрузки'),metric('Годный остаток',number(s.available)+' ед.','Не отгружено на '+displayDate(to)),metric('Брак производства',productionPercent(s.bad,s.checked),number(s.bad)+' из '+number(s.checked)+' изделий',s.bad?'negative':'positive'),metric('Брак поставщиков',productionPercent(s.supplierBad,s.supplierChecked),number(s.supplierBad)+' из '+number(s.supplierChecked)+' комплектующих',s.supplierBad?'negative':'positive'),metric('Оплачено комплектующих',money(s.paid),'По оплатам за период')].join('');
  const buckets=productionBuckets(),max=Math.max(1,...buckets.map(b=>Math.max(b.good+b.bad,b.shipped)));
  $('productionChart').innerHTML=buckets.length?'<div class="production-bars" role="img" aria-label="Выпуск годных изделий, брак и отгрузки по выбранным интервалам">'+buckets.map(b=>'<div class="production-bar-column"><div class="production-bar-values">'+b.good+' / '+b.shipped+'</div><div class="production-bar-pair"><div class="production-stacked" style="height:'+((b.good+b.bad)/max*130)+'px"><span class="production-bad-bar" style="flex:'+b.bad+'"></span><span class="production-good-bar" style="flex:'+b.good+'"></span></div><div class="production-shipped-bar" style="height:'+(b.shipped/max*130)+'px"></div></div><span>'+escapeHtml(productionData.group==='month'?b.key.slice(0,7):displayDate(b.key).slice(0,5))+'</span></div>').join('')+'</div>':empty('В выбранном периоде нет данных');
  $('productionStatus').innerHTML=scopeIds().map(id=>{const p=productionSummary([id]),allShipments=productionData.shipments.filter(s=>s.project===id),sent=allShipments.filter(s=>s.shippedAt&&s.shippedAt<=to).reduce((n,s)=>n+s.quantity,0),planned=allShipments.reduce((n,s)=>n+s.quantity,0);return '<div class="list-row"><div class="list-row-top"><h3>'+planningProjects[id].code+'</h3>'+badge(p.overdue?'Просрочено: '+p.overdue:p.blocked?'Блокер отгрузки':'По графику',p.overdue?'risk':p.blocked?'warning':'good')+'</div><p>'+planningProjects[id].name+' · отгружено '+sent+' из '+planned+' ед.</p><div class="budget-track"><span style="width:'+(planned?sent/planned*100:0)+'%;background:var(--accent)"></span></div><p>Остаток '+p.available+' ед. · выпуск за период '+p.good+' ед.</p></div>';}).join('');
  const shipments=productionData.shipments.filter(inScope).filter(s=>!s.shippedAt||s.shippedAt>to||productionInRange(s.shippedAt)).sort((a,b)=>a.due.localeCompare(b.due));
  $('productionShipmentRows').innerHTML=shipments.map(s=>{const status=productionShipmentStatus(s);return '<tr><td><strong>'+escapeHtml(s.document)+'</strong><small>'+planningProjects[s.project].code+'</small></td><td class="mono">'+s.quantity+' ед.</td><td class="mono">'+displayDate(s.due)+'</td><td>'+badge(status.label,status.kind)+'<small>'+escapeHtml(s.shippedAt&&s.shippedAt<=to?displayDate(s.shippedAt):s.blocker||'Ожидает отгрузки')+'</small></td><td>'+(!s.shippedAt?'<button class="btn small" data-production-ship="'+s.id+'" type="button">Зафиксировать отгрузку</button>':'—')+'</td></tr>';}).join('')||'<tr><td colspan="5">'+empty('Отгрузок нет')+'</td></tr>';
  const defects=productionSnapshot(productionData.source).defects;
  $('productionDefectCount').textContent=defects.length+' АКТОВ';
  $('productionDefectRows').innerHTML=defects.map(d=>'<tr><td><strong>'+escapeHtml(d.document)+'</strong><small>'+displayDate(d.date)+' · '+planningProjects[d.project].code+'</small></td><td>'+badge(productionSources[d.source],d.source==='supplier'?'warning':'neutral')+'<small>'+escapeHtml(d.batchName)+'</small></td><td><strong>'+d.quantity+' ед.</strong><small>'+money(d.cost)+'</small></td><td class="production-reason">'+escapeHtml(d.reason)+'</td><td>'+badge(productionDefectStatuses[d.status],d.status==='closed'?'good':'risk')+'</td><td><button class="btn small" data-production-defect="'+d.id+'" type="button">Разобрать</button></td></tr>').join('')||'<tr><td colspan="6">'+empty('Брак за выбранный период не зафиксирован')+'</td></tr>';
  $('productionCostRows').innerHTML=productionPurchases().filter(inScope).filter(p=>productionInRange(p.date)).map(p=>'<tr><td><button class="production-text-link" data-purchase="'+p.id+'" type="button">'+p.id+' ↗</button><small>'+escapeHtml(p.component)+'</small></td><td>'+escapeHtml(p.supplier)+'<small>'+planningProjects[p.project].code+'</small></td><td class="mono">'+displayDate(p.date)+'</td><td class="mono">'+money(p.amount)+'</td><td class="mono accent">'+money(p.paid)+'</td><td class="mono">'+money(p.amount-p.paid)+'</td></tr>').join('')||'<tr><td colspan="6">'+empty('Оплат и заказов за период нет')+'</td></tr>';
  const runs=productionData.runs.filter(inScope).filter(r=>productionInRange(r.date));
  $('productionRunRows').innerHTML=runs.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>'<tr><td><strong>'+escapeHtml(r.code)+' · '+escapeHtml(r.revision)+'</strong><small>'+planningProjects[r.project].code+' · '+escapeHtml(r.document)+'</small></td><td>'+displayDate(r.date)+'</td><td class="mono">'+r.checked+'</td><td class="mono positive">'+productionGood(r)+'</td><td class="mono negative">'+productionRejects('production',r.id)+'</td></tr>').join('')||'<tr><td colspan="5">'+empty('Выпуска за выбранный период нет')+'</td></tr>';
}
function setProductionRange(range) {
  if(!['day','week','month','quarter','custom'].includes(range))return;
  $('productionDateError').hidden=true;
  const date=new Date(productionAsOf+'T00:00:00Z');let from=productionAsOf;
  if(range==='week'){date.setUTCDate(date.getUTCDate()-6);from=date.toISOString().slice(0,10);}
  if(range==='month')from=productionAsOf.slice(0,7)+'-01';
  if(range==='quarter')from=productionAsOf.slice(0,4)+'-'+String(Math.floor(date.getUTCMonth()/3)*3+1).padStart(2,'0')+'-01';
  productionData.range=range;if(range!=='custom'){productionData.from=from;productionData.to=productionAsOf;}persist();renderProduction();
}
function productionFormError(id,message) {$(id).textContent=message;$(id).hidden=false;}
function openProductionRun() {const f=$('productionRunForm');f.reset();f.elements.project.value=scope==='all'?'aurora':scope;f.elements.date.value=productionAsOf;$('productionRunError').hidden=true;$('productionRunDialog').showModal();}
function saveProductionRun(event) {
  event.preventDefault();const f=$('productionRunForm');if(!f.reportValidity())return;const val=k=>f.elements[k].value.trim();
  const r={id:uid('run'),project:val('project'),code:val('code'),revision:val('revision'),date:val('date'),checked:Number(val('checked')),document:val('document')};
  const err=!projectIds.includes(r.project)||!validProductionDate(r.date)||r.date>productionAsOf?'Выберите проект и дату не позднее даты демонстрационного среза.':!r.code||!r.revision||!r.document?'Укажите партию, ревизию и документ ОТК.':!Number.isInteger(r.checked)||r.checked<=0||r.checked>1000000?'Количество должно быть целым и больше нуля.':productionData.runs.some(x=>x.project===r.project&&x.code.toLowerCase()===r.code.toLowerCase())?'Партия с таким кодом уже существует.':null;
  if(err)return productionFormError('productionRunError',err);
  productionData.runs.push(r);persist();$('productionRunDialog').close();renderProduction();notify('Выпуск зафиксирован. При наличии брака добавьте отдельный акт по этой партии.');
}
function fillProductionBatches() {
  const f=$('productionDefectForm'),source=f.elements.source.value,project=f.elements.project.value,items=source==='production'?productionData.runs:productionPurchases();
  f.elements.batchId.innerHTML=items.filter(r=>r.project===project).map(r=>'<option value="'+r.id+'">'+escapeHtml(productionBatchName(source,r))+'</option>').join('');
}
function openProductionDefect() {const f=$('productionDefectForm');f.reset();f.elements.project.value=scope==='all'?'aurora':scope;f.elements.date.value=productionAsOf;fillProductionBatches();$('productionDefectError').hidden=true;$('productionDefectDialog').showModal();}
function saveProductionDefect(event) {
  event.preventDefault();const f=$('productionDefectForm');if(!f.reportValidity())return;const v=k=>f.elements[k].value.trim();
  const d={id:uid('defect'),source:v('source'),project:v('project'),batchId:v('batchId'),date:v('date'),quantity:Number(v('quantity')),cost:Number(v('cost'))/1000,reason:v('reason'),document:v('document'),owner:v('owner'),action:v('action'),status:'open',events:[]};
  const batch=productionBatch(d.source,d.batchId),existing=productionRejects(d.source,d.batchId,productionAsOf);
  let err=!batch||batch.project!==d.project?'Выберите партию выбранного проекта.':!validProductionDate(d.date)||d.date<batch.date||d.date>productionAsOf?'Дата акта должна быть между датой партии и датой среза.':!Number.isInteger(d.quantity)||d.quantity<=0||existing+d.quantity>batch.checked?'Брак не может превышать проверенное количество партии с учётом прежних актов.':!Number.isFinite(d.cost)||d.cost<0||d.cost>100000?'Укажите корректную стоимость потерь в рублях.':['reason','document','owner','action'].some(k=>!d[k])?'Заполните описание, акт, ответственного и план действий.':productionData.defects.some(x=>x.document.toLowerCase()===d.document.toLowerCase())?'Акт с таким номером уже зарегистрирован.':null;
  if(!err&&d.source==='production'){
    // Never let a later defect retrospectively make shipped stock negative.
    const dates=[...new Set([d.date,productionAsOf,...productionData.shipments.filter(s=>s.project===d.project&&s.shippedAt&&s.shippedAt>=d.date).map(s=>s.shippedAt),...productionData.defects.filter(x=>x.source==='production'&&x.project===d.project&&x.date>=d.date).map(x=>x.date)])];
    if(dates.some(date=>productionAvailable(d.project,date)<d.quantity))err='Эти изделия уже отгружены или учтены в других актах. Для возврата нужна отдельная операция; повторно списать их нельзя.';
  }
  if(err)return productionFormError('productionDefectError',err);
  productionData.defects.push(d);persist();$('productionDefectDialog').close();renderProduction();notify('Факт брака зарегистрирован; показатели и отчёты обновлены.');
}
function openProductionDefectReview(id) {
  const d=productionData.defects.find(x=>x.id===id);if(!d)return;const f=$('productionReviewForm');f.reset();f.elements.defectId.value=id;f.elements.status.value=d.status;f.elements.action.value=d.action;$('productionReviewContext').textContent=d.document+' · '+productionSources[d.source]+' · '+d.quantity+' ед.';
  $('productionReviewDetails').innerHTML='<p>'+escapeHtml(d.reason)+'</p><p>'+escapeHtml(productionBatchName(d.source,productionBatch(d.source,d.batchId)))+' · '+escapeHtml(d.owner)+' · потери '+money(d.cost)+'</p><h3>История решений</h3>'+((d.events??[]).map(e=>'<p>'+escapeHtml(new Date(e.at).toLocaleString('ru-RU')+' · '+productionDefectStatuses[e.before]+' → '+productionDefectStatuses[e.after])+'<br>'+escapeHtml(e.reason)+'<br>'+escapeHtml(e.action)+'</p>').join('')||'<p>Решений ещё нет. Исходный факт сохранён.</p>');
  $('productionReviewError').hidden=true;$('productionReviewDialog').showModal();
}
function saveProductionDefectReview(event) {
  event.preventDefault();const f=$('productionReviewForm');if(!f.reportValidity())return;const d=productionData.defects.find(x=>x.id===f.elements.defectId.value),status=f.elements.status.value,reason=f.elements.reason.value.trim(),action=f.elements.action.value.trim();
  if(!d||!(status in productionDefectStatuses)||!reason||!action)return productionFormError('productionReviewError','Укажите решение и корректирующие действия.');
  d.events??=[];d.events.push({at:new Date().toISOString(),before:d.status,after:status,reason,action});d.status=status;d.action=action;persist();$('productionReviewDialog').close();renderProduction();notify('Решение сохранено. Закрытие акта не удаляет факт брака и не возвращает изделия в годный остаток.');
}
function openProductionShipment(id) {const s=productionData.shipments.find(x=>x.id===id);if(!s||s.shippedAt)return;const f=$('productionShipmentForm');f.reset();f.elements.shipmentId.value=id;f.elements.date.value=productionAsOf;$('productionShipmentContext').textContent=planningProjects[s.project].code+' · '+s.quantity+' ед. · '+s.document+(s.blocker?' · '+s.blocker:'');$('productionShipmentError').hidden=true;$('productionShipmentDialog').showModal();}
function saveProductionShipment(event) {
  event.preventDefault();const f=$('productionShipmentForm');if(!f.reportValidity())return;const s=productionData.shipments.find(x=>x.id===f.elements.shipmentId.value),date=f.elements.date.value,document=f.elements.document.value.trim(),reason=f.elements.reason.value.trim();
  let err=!s||s.shippedAt?'Отгрузка уже зафиксирована.':!validProductionDate(date)||date>productionAsOf?'Укажите дату не позднее даты среза.':!document||!reason?'Укажите документ и основание допуска к отгрузке.':null;
  if(!err){const dates=[...new Set([date,productionAsOf,...productionData.shipments.filter(x=>x.project===s.project&&x.shippedAt&&x.shippedAt>=date).map(x=>x.shippedAt),...productionData.defects.filter(d=>d.source==='production'&&d.project===s.project&&d.date>=date).map(d=>d.date)])];if(dates.some(day=>productionAvailable(s.project,day)<s.quantity))err='Недостаточно годных изделий на дату отгрузки с учётом других отгрузок и брака.';}
  if(err)return productionFormError('productionShipmentError',err);
  s.shippedAt=date;s.actualDocument=document;s.releaseReason=reason;persist();$('productionShipmentDialog').close();renderProduction();notify('Отгрузка зарегистрирована. Доступный остаток пересчитан.');
}
function productionReportRows(p) {
  if(!p)return [];
  return [[],['ПРОИЗВОДСТВО',displayDate(p.from)+' — '+displayDate(p.to)],['Показатель','Значение'],['Проверено изделий',p.summary.checked],['Выпущено годных',p.summary.good],['Отгружено за период',p.summary.shipped],['Годный неотгруженный остаток',p.summary.available],['Брак производства, %',p.summary.checked?p.summary.bad/p.summary.checked*100:'Нет базы'],['Брак поставщиков, %',p.summary.supplierChecked?p.summary.supplierBad/p.summary.supplierChecked*100:'Нет базы'],['Оплачено комплектующих, тыс. руб.',p.summary.paid],[],['ВЫПУСК'],['Партия','Проект','Дата','Ревизия','Проверено','Годных','Брак','Документ'],...p.runs.map(r=>[r.code,planningProjects[r.project].code,r.date,r.revision,r.checked,r.good,r.defect,r.document]),[],['ОТГРУЗКИ'],['Заказ','Проект','Количество','Плановая дата','Фактическая дата','Статус','Блокер','Документ отгрузки','Основание допуска'],...p.shipments.map(s=>[s.document,planningProjects[s.project].code,s.quantity,s.due,s.shippedAt&&s.shippedAt<=p.to?s.shippedAt:'',s.status,s.blocker,s.shippedAt&&s.shippedAt<=p.to?s.actualDocument||s.document:'',s.releaseReason]),[],['ОТЧЁТ ПО БРАКУ',p.source==='all'?'Все источники':productionSources[p.source]],['Акт','Источник','Проект','Партия','Дата','Количество','Потери, тыс. руб.','Описание','Статус','Ответственный','Действия','История решений'],...p.defects.map(d=>[d.document,productionSources[d.source],planningProjects[d.project].code,d.batchName,d.date,d.quantity,d.cost,d.reason,productionDefectStatuses[d.status],d.owner,d.action,(d.events??[]).map(e=>e.at+' '+productionDefectStatuses[e.after]+': '+e.reason).join(' | ')]),[],['СТОИМОСТЬ КОМПЛЕКТУЮЩИХ'],['Закупка','Проект','Поставщик','Дата','Заказано, тыс. руб.','Оплачено, тыс. руб.','Остаток оплаты, тыс. руб.','Документ'],...p.purchases.map(r=>[r.id,planningProjects[r.project].code,r.supplier,r.date,r.amount,r.paid,r.amount-r.paid,r.document])];
}
function productionReportHtml(p) {
  if(!p)return '';
  const table=(heads,rows)=>'<table><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join('')+'</tr>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escapeHtml(typeof cell==='number'?number(cell):cell)+'</td>').join('')+'</tr>').join('')+'</table>';
  return '<h2>Производство</h2><p>Период: '+displayDate(p.from)+' — '+displayDate(p.to)+'. Финансовые суммы — в тыс. руб. Брак: производство / проверенные изделия; поставщики / проверенные комплектующие. Остатки и статусы отгрузок — накопительно на конец периода.</p>'+table(['Показатель','Значение'],[['Выпущено годных',p.summary.good],['Отгружено за период',p.summary.shipped],['Годный неотгруженный остаток',p.summary.available],['Брак производства',productionPercent(p.summary.bad,p.summary.checked)],['Брак поставщиков',productionPercent(p.summary.supplierBad,p.summary.supplierChecked)],['Оплачено комплектующих, тыс. руб.',p.summary.paid]])+'<h3>Выпуск</h3>'+table(['Партия / проект','Дата','Проверено','Годных','Брак'],p.runs.map(r=>[r.code+' / '+planningProjects[r.project].code,displayDate(r.date),r.checked,r.good,r.defect]))+'<h3>Отгрузки</h3>'+table(['Заказ / проект','Количество','Срок / факт','Статус','Блокер / допуск'],p.shipments.map(s=>[s.document+' / '+planningProjects[s.project].code,s.quantity,displayDate(s.due)+' / '+(s.shippedAt&&s.shippedAt<=p.to?displayDate(s.shippedAt):'—'),s.status,s.releaseReason||s.blocker]))+'<h3>Отчёт по браку · '+escapeHtml(p.source==='all'?'Все источники':productionSources[p.source])+'</h3>'+p.defects.map(d=>'<p><strong>'+escapeHtml(d.document+' · '+productionSources[d.source])+'</strong><br>'+escapeHtml(d.batchName+' · '+planningProjects[d.project].code)+'<br>'+d.quantity+' ед. · потери '+reportMoney(d.cost)+' · '+escapeHtml(productionDefectStatuses[d.status])+'<br>'+escapeHtml(d.reason)+'<br>Ответственный: '+escapeHtml(d.owner)+'<br>Действия: '+escapeHtml(d.action)+(d.events??[]).map(e=>'<br>Решение: '+escapeHtml(productionDefectStatuses[e.after]+' · '+e.reason+' · '+e.action)).join('')+'</p>').join('')+'<h3>Комплектующие, тыс. руб.</h3>'+table(['Закупка / проект','Поставщик','Заказано','Оплачено','К оплате'],p.purchases.map(r=>[r.id+' / '+planningProjects[r.project].code,r.supplier,r.amount,r.paid,r.amount-r.paid]));
}
function downloadProductionReport(data,format,name) {
  const p=data.production;let body,type,extension;
  if(format==='json'){body=JSON.stringify({system:'ЭПСИЛОН',currency:'RUB',financialUnit:'тыс. руб.',scope:data.scopeName,capturedAt:data.capturedAt,production:p},null,2);type='application/json';extension='json';}
  else if(format==='word'){body='\ufeff<html><head><meta charset="utf-8"><style>body{font-family:Arial}table{border-collapse:collapse;width:100%}td{border:1px solid #aaa;padding:6px;font-size:10px}</style></head><body><h1>ЭПСИЛОН · Производство</h1><p>'+escapeHtml(data.scopeName)+'</p>'+productionReportHtml(p)+'<p>Демонстрационный снимок; не бухгалтерский отчёт.</p></body></html>';type='application/msword;charset=utf-8';extension='doc';}
  else {body='\ufeff'+[['ЭПСИЛОН · Производство',data.scopeName],['Единицы денежных сумм','тыс. руб.'],...productionReportRows(p)].map(row=>row.map(csvCell).join(';')).join('\r\n');type='text/csv;charset=utf-8';extension='csv';}
  const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name+'.'+extension;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportProduction(format,source='all') {
  const data=snapshot();data.reportKind='production';data.production=productionSnapshot(source);const name='EPSILON-production-'+(scope==='all'?'portfolio':planningProjects[scope].code)+'-'+productionData.from+'-'+productionData.to+'-'+source+'-'+Date.now(),id=uid('RPT');
  downloadProductionReport(data,format,name);reportHistory.unshift({id,name,format,snapshot:data,createdAt:data.capturedAt});reportHistory=reportHistory.slice(0,25);persist();renderReports();notify('Производственный отчёт сохранён в истории. Суммы — в тыс. руб.');
}
function setupProduction() {
  $('productionRange').addEventListener('change',e=>setProductionRange(e.target.value));
  $('productionDatesForm').addEventListener('submit',e=>{e.preventDefault();const from=$('productionFrom').value,to=$('productionTo').value;if(!validProductionDate(from)||!validProductionDate(to)||from>to||to>productionAsOf||Date.parse(to)-Date.parse(from)>366*86400000){productionFormError('productionDateError','Выберите корректный период до даты среза, не длиннее 366 дней.');return;}$('productionDateError').hidden=true;Object.assign(productionData,{range:'custom',from,to});persist();renderProduction();});
  for(const [id,key] of [['productionGroup','group'],['productionSource','source']])$(id).addEventListener('change',e=>{productionData[key]=e.target.value;persist();renderProduction();});
  $('addProductionRun').addEventListener('click',openProductionRun);$('addProductionDefect').addEventListener('click',openProductionDefect);
  for(const [id,handler] of [['productionRunForm',saveProductionRun],['productionDefectForm',saveProductionDefect],['productionReviewForm',saveProductionDefectReview],['productionShipmentForm',saveProductionShipment]])$(id).addEventListener('submit',handler);
  for(const name of ['project','source'])$('productionDefectForm').elements[name].addEventListener('change',fillProductionBatches);
  document.addEventListener('click',e=>{const defect=e.target.closest('[data-production-defect]'),ship=e.target.closest('[data-production-ship]'),exp=e.target.closest('[data-production-export]');if(defect)openProductionDefectReview(defect.dataset.productionDefect);if(ship)openProductionShipment(ship.dataset.productionShip);if(exp)exportProduction($('productionExportFormat').value,exp.dataset.productionExport);});
}
