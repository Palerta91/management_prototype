'use strict';

// A component revision is separate from inventory and from financial approval.
const techProducts = {
  aurora:{ name:'Силовой модуль AURORA-02', version:'Сборка B2 · итерация I-05', batch:24, due:'2026-10-30' },
  orbit:{ name:'Контур навигации ORBIT-01', version:'Сборка B3 · итерация I-04', batch:20, due:'2026-11-12' },
  nova:{ name:'Оптический модуль NOVA-03', version:'Сборка B1 · итерация I-03', batch:16, due:'2026-10-28' }
};
const techRates = { EUR:1, USD:0.92, RUB:0.01 };
const techVerificationLabels = { passed:'Проверка пройдена', pending:'На верификации', notRequested:'Нужна верификация', failed:'Проверка не пройдена' };
const techRequestStatuses = { pending:'На согласовании', passed:'Пройдено', failed:'Не пройдено', outdated:'Ревизия устарела', needsReview:'Нужна актуализация' };
const componentSeed = [
  { id:'a-gan', project:'aurora', code:'GM-84', name:'GaN-модуль', group:'Силовая электроника', revision:'Rev B', perUnit:4, stock:60, defect:0, onOrder:36, arrival:'2026-10-16', verification:'passed', document:'TEST-21 · PO-287', spec:'650 V / 80 A; тепловое сопротивление ≤ 0,45 K/W.', unitPrice:965, currency:'USD', ownerId:'team-0' },
  { id:'a-sensor', project:'aurora', code:'TS-48', name:'Температурный датчик', group:'Силовая электроника', revision:'Rev C', perUnit:10, stock:199, defect:41, onOrder:0, verification:'failed', document:'TEST-17 · LOT-032 · CR-08', spec:'−40…150 °C; погрешность ≤ 0,5 °C. У 41 датчика дрейф выше допуска.', unitPrice:76.67, currency:'EUR', ownerId:'team-1' },
  { id:'a-board', project:'aurora', code:'PCB-04', name:'Плата управления', group:'Силовая электроника', revision:'Rev D', perUnit:1, stock:24, defect:0, onOrder:0, verification:'pending', document:'CR-09 · схема SCH-04-D', spec:'Новая разводка цепей измерения; необходимо подтвердить EMC и точность канала.', unitPrice:480, currency:'EUR', ownerId:'team-1' },
  { id:'a-radiator', project:'aurora', code:'MX-21', name:'Теплоотвод', group:'Механика и сборка', revision:'Rev A', perUnit:1, stock:28, defect:0, onOrder:0, verification:'passed', document:'TEST-12 · PO-301', spec:'Алюминий 6061; Rth ≤ 0,32 K/W. Термоциклирование пройдено.', unitPrice:1603.57, currency:'EUR', ownerId:'team-0' },
  { id:'a-harness', project:'aurora', code:'CB-M', name:'Кабельный жгут серии M', group:'Механика и сборка', revision:'Rev A', perUnit:2, stock:0, defect:0, onOrder:0, verification:'passed', document:'PR-119 · EXC-04', spec:'Два жгута на модуль, разъёмы IP67. КП поставщика не получено.', unitPrice:252, currency:'EUR', ownerId:'team-3' },
  { id:'a-housing', project:'aurora', code:'HS-02', name:'Корпус модуля', group:'Механика и сборка', revision:'Rev C', perUnit:1, stock:24, defect:0, onOrder:0, verification:'passed', document:'TEST-23 · чертёж M-02-C', spec:'Герметичный корпус IP67; размеры и сборочные базы подтверждены.', unitPrice:310, currency:'EUR', ownerId:'team-0' },
  { id:'o-board', project:'orbit', code:'PCB-N', name:'Плата управления навигацией', group:'Электроника', revision:'Rev C', perUnit:6, stock:108, defect:12, onOrder:0, verification:'failed', document:'TEST-31 · LOT-055 · BC-041', spec:'12 плат отклонено по электрическому контролю; требуется повторный выпуск.', unitPrice:321.67, currency:'EUR', ownerId:'team-5' },
  { id:'o-gnss', project:'orbit', code:'NX-2', name:'GNSS-приёмник', group:'Электроника', revision:'Rev A', perUnit:2, stock:40, defect:0, onOrder:0, verification:'notRequested', document:'PO-412 · EXC-07', spec:'Приёмники в наличии; не приложен протокол проверки точности позиционирования.', unitPrice:1424, currency:'USD', ownerId:'team-6' },
  { id:'o-imu', project:'orbit', code:'IMU-7', name:'Инерциальный модуль', group:'Электроника', revision:'Rev B', perUnit:1, stock:20, defect:0, onOrder:0, verification:'passed', document:'TEST-33 · LOT-057', spec:'Стабильность нуля и калибровка соответствуют программе испытаний.', unitPrice:720, currency:'EUR', ownerId:'team-5' },
  { id:'o-antenna', project:'orbit', code:'ANT-2', name:'Антенна GNSS', group:'Радиотракт и корпус', revision:'Rev A', perUnit:2, stock:40, defect:0, onOrder:0, verification:'passed', document:'TEST-34 · PO-420', spec:'Двухчастотная антенна; усиление и согласование подтверждены.', unitPrice:185, currency:'EUR', ownerId:'team-6' },
  { id:'o-shield', project:'orbit', code:'EMC-04', name:'Экран электромагнитной защиты', group:'Радиотракт и корпус', revision:'Rev B', perUnit:1, stock:0, defect:0, onOrder:20, arrival:'2026-10-18', verification:'notRequested', document:'TEST-29 · BC-040', spec:'Изменена геометрия экрана; повторить EMC предиспытания.', unitPrice:140, currency:'EUR', ownerId:'team-7' },
  { id:'n-sensor', project:'nova', code:'SP-90', name:'Сенсор спектра', group:'Измерительный канал', revision:'Rev B', perUnit:2, stock:32, defect:0, onOrder:0, verification:'passed', document:'TEST-42 · PO-510', spec:'Погрешность измерительного канала в пределах допуска; калибровка пройдена.', unitPrice:2631.25, currency:'EUR', ownerId:'team-11' },
  { id:'n-board', project:'nova', code:'AFE-03', name:'Плата аналогового тракта', group:'Измерительный канал', revision:'Rev A', perUnit:1, stock:16, defect:0, onOrder:0, verification:'passed', document:'TEST-43 · SCH-03', spec:'Уровень шума ≤ 2,1 µV; линейность подтверждена.', unitPrice:420, currency:'EUR', ownerId:'team-11' },
  { id:'n-window', project:'nova', code:'OW-C2', name:'Оптическое окно', group:'Оптика и механика', revision:'Rev C2', perUnit:4, stock:69, defect:7, onOrder:0, verification:'failed', document:'TEST-46 · LOT-064 · BC-052', spec:'7 образцов отклонено по адгезии покрытия; ревизия не допущена к сборке.', unitPrice:359.21, currency:'EUR', ownerId:'team-12' },
  { id:'n-lens', project:'nova', code:'LN-08', name:'Линза коллиматора', group:'Оптика и механика', revision:'Rev A', perUnit:1, stock:8, defect:0, onOrder:8, arrival:'2026-10-20', verification:'passed', document:'PO-519 · TEST-44', spec:'Просветляющее покрытие; остаток партии ожидается от поставщика.', unitPrice:195, currency:'USD', ownerId:'team-13' },
  { id:'n-case', project:'nova', code:'OC-03', name:'Корпус оптического модуля', group:'Оптика и механика', revision:'Rev B', perUnit:1, stock:16, defect:0, onOrder:0, verification:'notRequested', document:'TEST-45 · M-03-B', spec:'Новая сборочная база требует повторного контроля соосности.', unitPrice:280, currency:'EUR', ownerId:'team-11' }
];
let techComponents = [], techRequests = [], techEvents = [];
let techProject = 'aurora', editingComponent = null, requestComponent = null, requestType = null, resultRequest = null;

function validTechComponent(c) {
  return c && /^[\w-]+$/.test(c.id) && projectIds.includes(c.project) && ['code','name','group','revision','spec','document'].every(key=>typeof c[key]==='string'&&c[key].length<=1200) && c.verification in techVerificationLabels && c.currency in techRates && ['perUnit','stock','defect','onOrder','unitPrice'].every(key=>Number.isFinite(c[key])&&c[key]>=0&&c[key]<=100000000) && Number.isInteger(c.perUnit) && c.perUnit>=1;
}
function initializeTechnology(data) {
  const state=data.technology??{};
  techComponents=Array.isArray(state.components)&&state.components.every(validTechComponent)?state.components:structuredClone(componentSeed);
  componentSeed.forEach(c=>{if(!techComponents.some(item=>item.id===c.id))techComponents.push(structuredClone(c));});
  techComponents.forEach(c=>{c.stockRevision??=c.revision;c.orderRevision??=c.revision;});
  techRequests=Array.isArray(state.requests)?state.requests.filter(validTechRequest):[];
  techEvents=Array.isArray(state.events)?state.events.filter(e=>e&&techComponents.some(c=>c.id===e.componentId)&&typeof e.reason==='string').slice(-200):[];
  techProject=projectIds.includes(state.project)?state.project:'aurora';
  if(!state.initialized) {
    const now='2026-10-03T09:20:00Z';
    techEvents.push({ id:'change-demo-board', componentId:'a-board', project:'aurora', at:now, type:'revision', title:'Плата управления · Rev C → Rev D', reason:'В TEST-19 зафиксирована наводка на измерительном канале. Разделены силовая и измерительная земли; ожидается снижение ошибки до 0,5%.', document:'CR-09 · схема SCH-04-D', before:{revision:'Rev C',spec:'Общая земля силового и измерительного канала.'}, after:structuredClone(techComponents.find(c=>c.id==='a-board')) });
    const request={id:'request-demo-board',code:'VR-001',type:'verification',componentId:'a-board',project:'aurora',revision:'Rev D',componentName:'Плата управления',status:'pending',ownerId:'team-1',due:'2026-10-14',reason:'Проверить новую разводку после устранения наводок, до допуска в тестовую сборку.',criteria:'EMC по методике EMC-04; ошибка измерения ≤ 0,5%; 3 образца, 10 температурных циклов.',document:'CR-09 · EMC-04',cost:2400,createdAt:now,taskId:'task-tech-demo-board'};
    techRequests.push(request); createTechTask(request);
  }
}
function validTechRequest(r) {
  return r&&/^[\w-]+$/.test(r.id)&&/^[\w-]+$/.test(r.taskId)&&['verification','purchase'].includes(r.type)&&r.status in techRequestStatuses&&projectIds.includes(r.project)&&techComponents.some(c=>c.id===r.componentId&&c.project===r.project)&&['code','revision','componentName','reason','criteria','document','due','ownerId'].every(key=>typeof r[key]==='string'&&r[key].length<=1200)&&/^\d{4}-\d{2}-\d{2}$/.test(r.due)&&Number.isFinite(r.cost)&&r.cost>=0&&r.cost<=100000000&&(r.type!=='purchase'||r.currency in techRates&&['quantity','unitPrice','rate'].every(key=>Number.isFinite(r[key])&&r[key]>0));
}
function technologyState() { return {initialized:true,components:techComponents,requests:techRequests,events:techEvents,project:techProject}; }
function requiredQuantity(c) { return c.perUnit*techProducts[c.project].batch; }
function usableStock(c) { return c.stockRevision===c.revision?c.stock:0; }
function usableOrder(c) { return c.orderRevision===c.revision?c.onOrder:0; }
function componentHealth(c) {
  const required=requiredQuantity(c),shortage=Math.max(0,required-usableStock(c)),ordered=usableOrder(c),issues=[];
  if(c.verification==='failed')issues.push({kind:'risk',text:'Ревизия не прошла проверку',action:'Изменить компонент',type:'change'});
  if(shortage>ordered)issues.push({kind:'risk',text:'Не покрыта потребность: '+(shortage-ordered)+' шт.',action:'Запросить закупку',type:'purchase'});
  else if(shortage)issues.push({kind:'warning',text:'В пути '+shortage+' шт. · '+displayDate(c.arrival),action:'Смотреть компонент',type:'details'});
  if(c.verification==='pending')issues.push({kind:'warning',text:'Ожидается результат верификации',action:'Открыть запрос',type:'verification'});
  if(c.verification==='notRequested')issues.push({kind:'warning',text:'Нет проверки актуальной ревизии',action:'Запросить верификацию',type:'verification'});
  // Defective stock is excluded from usable stock. Passing a test does not erase losses.
  if(c.defect)issues.push({kind:'risk',text:'Брак: '+c.defect+' шт. · требуется решение по партии',action:'Смотреть компонент',type:'details'});
  if(c.stock&&c.stockRevision!==c.revision)issues.push({kind:'risk',text:'Остаток '+c.stock+' шт. относится к '+c.stockRevision+', а не к '+c.revision,action:'Смотреть компонент',type:'details'});
  const kind=issues.some(i=>i.kind==='risk')?'risk':issues.length?'warning':'good';
  return {kind,label:kind==='risk'?'Блокер':kind==='warning'?'Ожидание':'Готово',issues,shortage};
}
function requestLabel(r) { return r.type==='verification'&&r.status==='pending'?'На верификации':techRequestStatuses[r.status]; }
function requestBadge(r) { return badge(requestLabel(r),r.status==='passed'?'good':r.status==='failed'?'risk':'warning'); }
function techOwner(id) { return users.find(u=>u.id===id)?.name??'Не назначен'; }
function euros(value) { return Number(value).toLocaleString('ru-RU',{style:'currency',currency:'EUR',maximumFractionDigits:2}); }
function techAction(c,type,label,primary=false) { return '<button class="btn small'+(primary?' primary':'')+'" data-tech-action="'+type+'" data-component-id="'+escapeHtml(c.id)+'" type="button">'+escapeHtml(label)+'</button>'; }
function addTechEvent(c,type,title,reason,document,extra={}) {
  techEvents.push({id:uid('change'),componentId:c.id,project:c.project,type,title,reason,document,at:new Date().toISOString(),...extra});
  techEvents=techEvents.slice(-200);
}
function createTechTask(r) {
  if(tasks.some(t=>t.id===r.taskId))return;
  const c=techComponents.find(item=>item.id===r.componentId),plan=r.cost/1000;
  tasks.push({id:r.taskId,code:r.code,project:r.project,stage:r.type==='verification'?'verification':'approval',title:(r.type==='verification'?'Верификация: ':'Закупка: ')+c.name+' · '+r.revision,ownerId:r.ownerId,owner:techOwner(r.ownerId),due:r.due,baseline:displayDate(r.due),forecast:displayDate(r.due),plan,actual:0,commitments:0,eac:plan,proposed:true,health:componentHealth(c).kind==='risk'?'risk':'ok',healthText:'Запрос из технологической карты',reason:r.reason,links:[c.code,r.revision,r.code,r.document],componentId:c.id,techRequestId:r.id});
}
function renderTechnology() {
  if(scope!=='all')techProject=scope;
  const product=techProducts[techProject],components=techComponents.filter(c=>c.project===techProject);
  $('techProjectSelect').value=techProject;
  const good=components.filter(c=>componentHealth(c).kind==='good'),blocked=components.filter(c=>componentHealth(c).kind==='risk'),warning=components.filter(c=>componentHealth(c).kind==='warning');
  const requests=techRequests.filter(r=>r.project===techProject),pending=requests.filter(r=>['pending','needsReview'].includes(r.status));
  $('techProduct').innerHTML='<div><span class="eyebrow">ТЕСТОВОЕ ИЗДЕЛИЕ / '+escapeHtml(product.version)+'</span><h2>'+escapeHtml(product.name)+'</h2><p>Партия '+product.batch+' изделий · контрольная сборка '+displayDate(product.due)+'</p></div><div class="tech-readiness"><strong>'+Math.round(good.length/components.length*100)+'%</strong><span>компонентов готово</span><div class="budget-track"><span style="width:'+good.length/components.length*100+'%;background:var(--good)"></span><span style="width:'+warning.length/components.length*100+'%;background:var(--warn)"></span><span style="width:'+blocked.length/components.length*100+'%;background:var(--bad)"></span></div></div>'+badge(blocked.length?'СБОРКА ЗАБЛОКИРОВАНА':warning.length?'ЕСТЬ ОЖИДАНИЯ':'МОЖНО СОБИРАТЬ',blocked.length?'risk':warning.length?'warning':'good');
  $('techMetrics').innerHTML=[metric('Компонентов',components.length,'Состав текущей сборки'),metric('Готово',good.length,'Проверка пройдена, запас достаточен','positive'),metric('Блокеров',blocked.length,'Не допускаются к сборке','negative'),metric('Верификация',pending.filter(r=>r.type==='verification').length,'Открытых запросов'),metric('Оценки закупок',money(pending.filter(r=>r.type==='purchase').reduce((s,r)=>s+r.cost,0)/1000),'Запросы, не расходы','accent')].join('');
  const query=$('techSearch').value.trim().toLocaleLowerCase('ru'),filter=$('techFilter').value;
  const visible=components.filter(c=>(filter==='all'||componentHealth(c).kind===filter)&&(c.code+' '+c.name+' '+c.group+' '+c.revision).toLocaleLowerCase('ru').includes(query));
  const groups=[...new Set(visible.map(c=>c.group))];
  $('techRows').innerHTML=groups.map(group=>'<tr class="tech-group"><th colspan="4">'+escapeHtml(group)+' <span>'+visible.filter(c=>c.group===group).length+' ПОЗ.</span></th></tr>'+visible.filter(c=>c.group===group).map(c=>{
    const h=componentHealth(c);
    return '<tr><td><button class="tech-component-link" data-tech-action="details" data-component-id="'+escapeHtml(c.id)+'" type="button"><strong>'+escapeHtml(c.name)+'</strong><span>'+escapeHtml(c.code)+' <b>'+escapeHtml(c.revision)+'</b></span></button><small>'+escapeHtml(techOwner(c.ownerId))+'</small></td><td><strong class="mono">'+c.perUnit+' / '+requiredQuantity(c)+' шт.</strong><small>Годных '+usableStock(c)+' · в пути '+usableOrder(c)+'</small>'+(c.stockRevision!==c.revision&&c.stock?'<small class="negative">'+c.stock+' шт. '+escapeHtml(c.stockRevision)+'</small>':'')+(c.defect?'<small class="negative">Брак '+c.defect+' шт.</small>':'')+'</td><td>'+badge(h.label,h.kind)+'<small class="tech-status-note">'+escapeHtml(h.issues[0]?.text??'Проверено · комплект обеспечен')+'</small></td><td><div class="tech-row-actions">'+techAction(c,'change','Изменить')+techAction(c,'verification','Верификация')+techAction(c,'purchase','Закупка')+'</div></td></tr>';
  }).join('')).join('')||'<tr><td colspan="4">'+empty('Компоненты не найдены')+'</td></tr>';
  $('techBlockerCount').textContent=blocked.length+' ПОЗ.';
  $('techBlockerList').innerHTML=blocked.length?blocked.map(c=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(c.name)+'</h3><span class="tech-code">'+escapeHtml(c.code)+'</span></div>'+componentHealth(c).issues.filter(i=>i.kind==='risk').map(i=>'<p class="negative">'+escapeHtml(i.text)+'</p>').join('')+'<div class="tech-row-actions" style="margin-top:12px">'+techAction(c,c.verification==='failed'?'change':'purchase',c.verification==='failed'?'Новая ревизия':'Запрос на закупку')+techAction(c,'details','Детали')+'</div></div>').join(''):empty('Критических блокеров нет. Ожидающие компоненты отмечены жёлтым в составе.');
  const requestFilter=$('techRequestFilter').value;
  $('techRequestList').innerHTML=renderTechRequestList(requests.filter(r=>requestFilter==='all'||r.type===requestFilter));
  $('techHistory').innerHTML=techEvents.filter(e=>e.project===techProject).slice(-8).reverse().map(e=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(e.title)+'</h3><span class="unit">'+new Date(e.at).toLocaleString('ru-RU')+'</span></div><p>'+escapeHtml(e.reason)+'</p><span class="unit">ОСНОВАНИЕ: '+escapeHtml(e.document)+' · '+escapeHtml(techComponents.find(c=>c.id===e.componentId)?.code)+'</span></div>').join('')||empty('Изменений состава пока нет. Предыдущая ревизия и основание будут сохранены при первом изменении.');
  $('techPurchaseInbox').innerHTML=renderTechRequestList(techRequests.filter(inScope).filter(r=>r.type==='purchase'));
  $('techVerificationInbox').innerHTML=renderTechRequestList(techRequests.filter(inScope).filter(r=>r.type==='verification'));
}
function renderTechRequestList(rows) {
  return rows.length?rows.slice().reverse().map(r=>'<div class="tech-request-row"><div><span class="eyebrow">'+escapeHtml(r.code)+' / '+(r.type==='purchase'?'ЗАКУПКА':'ВЕРИФИКАЦИЯ')+' / '+planningProjects[r.project].code+'</span><h3>'+escapeHtml(r.componentName)+' · '+escapeHtml(r.revision)+'</h3><p>'+escapeHtml(techOwner(r.ownerId))+' · до '+displayDate(r.due)+(r.type==='purchase'?' · '+r.quantity+' шт.':'')+' · оценка '+euros(r.cost)+'</p></div><div class="tech-request-actions">'+requestBadge(r)+'<button class="btn small" data-tech-request="'+escapeHtml(r.id)+'" type="button">Открыть</button></div></div>').join(''):empty('Запросов пока нет. Создайте запрос из строки компонента.');
}
function openComponent(id) {
  const c=techComponents.find(item=>item.id===id);if(!c)return;
  const h=componentHealth(c),requests=techRequests.filter(r=>r.componentId===id);
  const body=badge(h.label,h.kind)+detailRows([['Проект',planningProjects[c.project].code],['Подсистема',c.group],['Ревизия',c.revision],['Ответственный',techOwner(c.ownerId)],['На изделие / партию',c.perUnit+' / '+requiredQuantity(c)+' шт.'],['Годных / в пути',usableStock(c)+' / '+usableOrder(c)+' шт. актуальной ревизии'],['Снимок склада',c.stock+' шт. '+c.stockRevision+' · в пути '+c.onOrder+' шт. '+c.orderRevision],['Брак',c.defect+' шт. · исключён из годных остатков'],['Верификация',techVerificationLabels[c.verification]],['Документ',c.document],['Ориентир цены',number(c.unitPrice)+' '+c.currency+' за единицу']])+'<div class="drawer-note">'+escapeHtml(c.spec)+'</div>'+(h.issues.length?'<div class="tech-detail-issues">'+h.issues.map(i=>'<p class="'+(i.kind==='risk'?'negative':'')+'">'+escapeHtml(i.text)+'</p>').join('')+'</div>':'')+'<div class="drawer-actions tech-wrap">'+techAction(c,'change','Изменить',true)+techAction(c,'verification','Верификация')+techAction(c,'purchase','Закупка')+'</div><div style="margin-top:24px"><span class="eyebrow">СВЯЗАННЫЕ ЗАПРОСЫ</span>'+renderTechRequestList(requests)+'</div><p class="form-note" style="margin-top:20px">Остатки — снимок входного контроля в демонстрации. Изменение ревизии не делает брак годным, не переклассифицирует старые остатки и не подтверждает поступление закупки.</p>';
  selectedTask=null;openDrawer('КОМПОНЕНТ / '+c.code,c.name,body);
}
function openComponentForm(id=null) {
  const c=id?techComponents.find(item=>item.id===id):null;
  editingComponent=id;closeDrawer();const form=$('componentForm');form.reset();
  $('componentFormContext').textContent=planningProjects[c?.project??techProject].code+(c?' / ТЕКУЩАЯ РЕВИЗИЯ '+c.revision:' / НОВАЯ ПОЗИЦИЯ');
  $('componentDialogTitle').textContent=c?'Изменение компонента':'Добавить компонент';
  for(const key of ['code','name','group','spec'])form.elements[key].value=c?.[key]??'';
  form.elements.code.readOnly=Boolean(c);form.elements.revision.value=c?'':'Rev A';form.elements.perUnit.value=c?.perUnit??1;form.elements.document.value=c?.document??'';
  $('componentFormNote').textContent=c?'Новая ревизия требует повторной верификации. Остатки и брак не обнуляются; открытые запросы прежней ревизии потребуют актуализации.':'Компонент добавится без подтверждённых остатков и проверки: потребуется верификация и закупка.';
  $('componentFormError').hidden=true;$('componentDialog').showModal();form.elements[c?'revision':'code'].focus();
}
function formText(form,key) { return form.elements[key].value.trim(); }
function formError(id,message) { $(id).textContent=message;$(id).hidden=false; }
function saveComponent(event) {
  event.preventDefault();const form=$('componentForm');if(!form.reportValidity())return;
  if(['code','revision','name','group','spec','reason','document'].some(key=>!formText(form,key))){formError('componentFormError','Заполните поля и укажите обоснование без пустых строк.');return;}
  const c=editingComponent?techComponents.find(item=>item.id===editingComponent):null;
  const code=formText(form,'code'),revision=formText(form,'revision');
  if(c&&revision.toLocaleLowerCase('ru')===c.revision.toLocaleLowerCase('ru')){formError('componentFormError','Укажите новую ревизию, отличную от текущей '+c.revision+'.');return;}
  if(!c&&techComponents.some(item=>item.project===techProject&&item.code.toLowerCase()===code.toLowerCase())){formError('componentFormError','В этом проекте уже есть компонент с таким кодом.');return;}
  const before=c?structuredClone(c):null;
  const values={code,revision,name:formText(form,'name'),group:formText(form,'group'),perUnit:Number(form.elements.perUnit.value),spec:formText(form,'spec'),document:formText(form,'document'),verification:'notRequested'};
  let item=c;
  if(c)Object.assign(c,values);
  else {item={id:uid('component'),project:techProject,stock:0,stockRevision:revision,defect:0,onOrder:0,orderRevision:revision,unitPrice:1,currency:'EUR',ownerId:users.find(u=>u.status==='active'&&u.projects.includes(techProject)&&u.role==='engineer')?.id??'admin',...values};techComponents.push(item);}
  if(c)techRequests.filter(r=>r.componentId===c.id&&r.status==='pending').forEach(r=>{
    r.status=r.type==='verification'?'outdated':'needsReview';
    const task=tasks.find(t=>t.id===r.taskId);if(task){task.stage='decision';task.health='risk';task.superseded=r.type==='verification';task.healthText='Ревизия компонента изменилась';task.reason+=' Требуется актуализация: '+before.revision+' → '+revision+'.';}
  });
  addTechEvent(item,'revision',item.name+' · '+(before?before.revision+' → ':'добавлен ')+revision,formText(form,'reason'),values.document,{before,after:structuredClone(item)});
  persist();$('componentDialog').close();$('techSearch').value='';$('techFilter').value='all';render();notify('Ревизия сохранена с обоснованием. Теперь нужна проверка актуального состава.');openComponent(item.id);
}
function pendingRequest(c,type) { return techRequests.find(r=>r.componentId===c.id&&r.revision===c.revision&&r.type===type&&r.status==='pending'); }
function openTechRequestForm(id,type) {
  const c=techComponents.find(item=>item.id===id);if(!c)return;
  const existing=pendingRequest(c,type);if(existing){openTechRequest(existing.id);notify('Для этой ревизии уже есть открытый запрос.');return;}
  requestComponent=id;requestType=type;closeDrawer();const form=$('techRequestForm');form.reset();
  const purchase=type==='purchase';
  $('techRequestTitle').textContent=purchase?'Запрос на закупку':'Запрос на верификацию';
  $('techRequestContext').textContent=planningProjects[c.project].code+' / '+c.code+' / '+c.revision;
  $('techPurchaseFields').hidden=!purchase;$('techVerificationCost').hidden=purchase;
  for(const key of ['quantity','unitPrice','currency','rate']){form.elements[key].disabled=!purchase;form.elements[key].required=purchase;}
  form.elements.cost.disabled=purchase;form.elements.cost.required=!purchase;
  const available=users.filter(u=>u.status==='active'&&u.projects.includes(c.project)&&u.role!=='investor');
  form.elements.owner.innerHTML=available.map(u=>'<option value="'+escapeHtml(u.id)+'">'+escapeHtml(u.name)+'</option>').join('');
  const responsible=purchase?available.find(u=>u.role==='procurement'):available.find(u=>u.id===c.ownerId);
  if(responsible)form.elements.owner.value=responsible.id;
  form.elements.due.value='2026-10-20';form.elements.quantity.value=Math.max(1,requiredQuantity(c)-usableStock(c)-usableOrder(c));form.elements.unitPrice.value=c.unitPrice;form.elements.currency.value=c.currency;form.elements.rate.value=techRates[c.currency];form.elements.cost.value=1800;
  form.elements.reason.value=purchase?'Обеспечить тестовую партию '+techProducts[c.project].batch+' изделий; '+c.name+' '+c.revision+'. '+componentHealth(c).issues.map(i=>i.text).join('; '):'Подтвердить соответствие '+c.name+' '+c.revision+' перед допуском в сборку.';
  form.elements.criteria.value=purchase?'Поставка компонента '+c.code+' '+c.revision+'; входной контроль по актуальной спецификации.':'Проверка по актуальной спецификации: '+c.spec;
  form.elements.document.value=c.document;
  $('techRequestCriteriaLabel').textContent=purchase?'Требования к поставке и приёмке *':'Методика и критерии приёмки *';
  $('techRequestError').hidden=true;updateTechEstimate();$('techRequestDialog').showModal();form.elements.reason.focus();
}
function updateTechEstimate() {
  const form=$('techRequestForm'),purchase=requestType==='purchase';
  const cost=purchase?Number(form.elements.quantity.value)*Number(form.elements.unitPrice.value)*Number(form.elements.rate.value):Number(form.elements.cost.value);
  $('techRequestEstimate').textContent='Бюджетная оценка: '+(Number.isFinite(cost)?euros(cost):'—')+(purchase?' · курс фиксируется в запросе (демосценарий 04.10.2026)':'');
}
function saveTechRequest(event) {
  event.preventDefault();const form=$('techRequestForm');if(!form.reportValidity())return;
  const c=techComponents.find(item=>item.id===requestComponent),type=requestType;
  if(!c||pendingRequest(c,type)){formError('techRequestError','Запрос уже существует или компонент недоступен.');return;}
  if(['reason','criteria','document'].some(key=>!formText(form,key))){formError('techRequestError','Укажите обоснование, требования и документ.');return;}
  const ownerId=form.elements.owner.value;if(!users.some(u=>u.id===ownerId&&u.status==='active'&&u.projects.includes(c.project)&&u.role!=='investor')){formError('techRequestError','Назначьте активного участника проекта.');return;}
  const purchase=type==='purchase',quantity=Number(form.elements.quantity.value),unitPrice=Number(form.elements.unitPrice.value),currency=form.elements.currency.value,rate=Number(form.elements.rate.value);
  if(purchase&&currency==='EUR'&&rate!==1){formError('techRequestError','Для EUR курс должен быть равен 1.');return;}
  const cost=purchase?Math.round(quantity*unitPrice*rate*100)/100:Number(form.elements.cost.value);
  if(!Number.isFinite(cost)||cost<0||cost>100000000){formError('techRequestError','Оценка запроса должна быть от 0 до 100 000 000 EUR.');return;}
  const r={id:uid('request'),code:(purchase?'PR':'VR')+'-TC-'+String(techRequests.filter(item=>item.type===type).length+1).padStart(3,'0'),type,componentId:c.id,componentName:c.name,project:c.project,revision:c.revision,status:'pending',ownerId,due:form.elements.due.value,reason:formText(form,'reason'),criteria:formText(form,'criteria'),document:formText(form,'document'),cost,createdAt:new Date().toISOString(),taskId:uid('task-tech')};
  if(purchase)Object.assign(r,{quantity,unitPrice,currency,rate,currencyAmount:Math.round(quantity*unitPrice*100)/100});else c.verification='pending';
  techRequests.push(r);createTechTask(r);addTechEvent(c,'request',r.code+' · '+(purchase?'запрос на закупку':'запрос на верификацию'),r.reason,r.document,{requestId:r.id});
  persist();$('techRequestDialog').close();render();notify('Запрос '+r.code+' создан. Карточка и бюджетная оценка связаны с компонентом.');openTechRequest(r.id);
}
function openTechRequest(id) {
  const r=techRequests.find(item=>item.id===id);if(!r)return;
  const c=techComponents.find(item=>item.id===r.componentId);
  const details=[['Проект',planningProjects[r.project].code],['Компонент',c.code+' · '+r.componentName],['Ревизия запроса',r.revision],['Текущая ревизия',c.revision],['Ответственный',techOwner(r.ownerId)],['Срок',displayDate(r.due)],['Оценка, не факт',euros(r.cost)],['Основание',r.document]];
  if(r.type==='purchase')details.splice(6,0,['Количество',r.quantity+' шт.'],['Цена / валюта',r.unitPrice.toLocaleString('ru-RU',{maximumFractionDigits:2})+' '+r.currency],['Курс зафиксирован',r.rate.toLocaleString('ru-RU',{maximumFractionDigits:6})+' EUR за 1 '+r.currency]);
  const result=r.result?'<div class="drawer-note" style="margin-top:20px"><strong>'+escapeHtml(r.result.document)+'</strong><p>'+escapeHtml(r.result.conclusion)+'</p></div>':'';
  const body=requestBadge(r)+detailRows(details)+'<span class="eyebrow">ОБОСНОВАНИЕ</span><div class="drawer-note" style="margin-top:8px">'+escapeHtml(r.reason)+'</div><div style="margin-top:20px"><span class="eyebrow">'+(r.type==='purchase'?'ПОСТАВКА И ПРИЁМКА':'КРИТЕРИИ ВЕРИФИКАЦИИ')+'</span><p class="muted" style="margin-top:8px">'+escapeHtml(r.criteria)+'</p></div>'+result+'<div class="drawer-actions tech-wrap">'+(r.type==='verification'&&r.status==='pending'&&r.revision===c.revision?'<button class="btn primary" data-tech-result="'+escapeHtml(r.id)+'" type="button">Зафиксировать результат</button>':'')+'<button class="btn" data-task="'+escapeHtml(r.taskId)+'" type="button">Карточка канбана ↗</button>'+techAction(c,'details','Компонент')+'</div><p class="form-note" style="margin-top:20px">'+(r.type==='purchase'?'Заявка не является заказом или оплатой. Согласование, поступление и приёмка в этом прототипе не моделируются.':'Результат допускает ревизию к дальнейшему использованию, но не изменяет остатки и финансовый факт.')+'</p>';
  selectedTask=null;openDrawer((r.type==='purchase'?'ЗАКУПКА':'ВЕРИФИКАЦИЯ')+' / '+r.code,r.componentName+' · '+r.revision,body);
}
function openVerificationResult(id) {
  const r=techRequests.find(item=>item.id===id),c=r&&techComponents.find(item=>item.id===r.componentId);
  if(!r||r.type!=='verification'||r.status!=='pending'||r.revision!==c?.revision){notify('Зафиксировать результат можно только для открытого запроса актуальной ревизии.');return;}
  resultRequest=id;closeDrawer();const form=$('verificationResultForm');form.reset();
  $('verificationResultContext').textContent=r.code+' / '+c.code+' / '+r.revision;$('verificationResultError').hidden=true;$('verificationResultDialog').showModal();form.elements.document.focus();
}
function saveVerificationResult(event) {
  event.preventDefault();const form=$('verificationResultForm');if(!form.reportValidity())return;
  const r=techRequests.find(item=>item.id===resultRequest),c=r&&techComponents.find(item=>item.id===r.componentId);
  if(!r||r.status!=='pending'||r.revision!==c?.revision){formError('verificationResultError','Запрос или ревизия изменились. Откройте актуальный запрос.');return;}
  if(!formText(form,'document')||!formText(form,'conclusion')){formError('verificationResultError','Укажите протокол и измеренные результаты.');return;}
  r.status=form.elements.result.value;c.verification=r.status;c.document=formText(form,'document');
  r.result={document:formText(form,'document'),conclusion:formText(form,'conclusion'),at:new Date().toISOString()};
  const task=tasks.find(t=>t.id===r.taskId);if(task){task.stage=r.status==='passed'?'closed':'decision';task.health=r.status==='passed'?'ok':'risk';task.links.push(r.result.document);}
  addTechEvent(c,'result',r.code+' · '+requestLabel(r),r.result.conclusion,r.result.document,{requestId:r.id});
  persist();$('verificationResultDialog').close();render();notify(r.status==='passed'?'Проверка пройдена. Остальные блокеры компонента проверены заново.':'Отклонение зафиксировано: компонент блокирует сборку.');openTechRequest(r.id);
}
function setupTechnology() {
  $('techProjectSelect').addEventListener('change',e=>{techProject=e.target.value;$('techSearch').value='';$('techFilter').value='all';selectProject(techProject);});
  $('techSearch').addEventListener('input',renderTechnology);$('techFilter').addEventListener('change',renderTechnology);$('techRequestFilter').addEventListener('change',renderTechnology);
  $('addComponent').addEventListener('click',()=>openComponentForm());$('componentForm').addEventListener('submit',saveComponent);$('techRequestForm').addEventListener('submit',saveTechRequest);$('verificationResultForm').addEventListener('submit',saveVerificationResult);
  $('techRequestForm').addEventListener('input',updateTechEstimate);$('techRequestForm').elements.currency.addEventListener('change',e=>{$('techRequestForm').elements.rate.value=techRates[e.target.value];updateTechEstimate();});
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-tech-action]');
    if(action){const id=action.dataset.componentId,type=action.dataset.techAction;if(type==='details')openComponent(id);else if(type==='change')openComponentForm(id);else openTechRequestForm(id,type);return;}
    const request=e.target.closest('[data-tech-request]');if(request){openTechRequest(request.dataset.techRequest);return;}
    const result=e.target.closest('[data-tech-result]');if(result)openVerificationResult(result.dataset.techResult);
  });
}
