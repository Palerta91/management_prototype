'use strict';

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const uid = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const storageKey = globalThis.epsilonAuth?'epsilon.workspace.user.'+globalThis.epsilonAuth.user.id:'epsilon.workspace.v1';
const saved = normalizeRubDemoData(loadState());
restoreProjectCatalog(saved);
const projectIds = Object.keys(planningProjects);
const roles = accessRoles;
const routes = { dashboard:'Дашборд', planning:'Планирование', production:'Производство', purchases:'Закупки', budget:'Бюджет', quality:'Качество и брак', testing:'Испытания', changes:'Корректировки', reports:'Отчёты', users:'Пользователи',admin:'Администрирование','access-denied':'Доступ ограничен' };
const stages = [
  { id:'backlog', label:'Бэклог', color:'#718493' },
  { id:'approval', label:'Ожидает', color:'#a999ff' },
  { id:'work', label:'В работе', color:'#63a7ff' },
  { id:'verification', label:'На верификации', color:'#55e6d2' },
  { id:'decision', label:'Блокеры', color:'#f4ba4b' },
  { id:'closed', label:'Завершено', color:'#4ddc8b' }
];
const profiles = {
  aurora: { q4:{ actual:948.1, commitments:228.5, eac:1327.4 }, quality:{ total:580, accepted:539, gross:43.6, recovery:19.4 }, tests:{ passed:17, total:22 }, docs:{ complete:28, total:35 }, readyOrders:9, totalOrders:14 },
  orbit: { q4:{ actual:661.3, commitments:174.4, eac:1004.2 }, quality:{ total:370, accepted:358, gross:18.6, recovery:11.2 }, tests:{ passed:13, total:18 }, docs:{ complete:31, total:34 }, readyOrders:7, totalOrders:10 },
  nova: { q4:{ actual:527.2, commitments:116.7, eac:832 }, quality:{ total:208, accepted:201, gross:12.8, recovery:9.4 }, tests:{ passed:19, total:21 }, docs:{ complete:22, total:28 }, readyOrders:8, totalOrders:9 }
};
const purchases = [
  { id:'PR-104', project:'aurora', component:'Температурный датчик TS-48 · Rev C', iteration:'I-04', status:'Брак', kind:'risk', accepted:199, quantity:240, defect:41, amount:18.4, complete:true, links:['LOT-032','TEST-17','CR-08'] },
  { id:'PO-287', project:'aurora', component:'GaN-модуль GM-84 · Rev B', iteration:'I-05', status:'В пути', kind:'warning', accepted:60, quantity:96, defect:0, amount:92.7, complete:true, links:['PR-093','LOT-041','BC-025'] },
  { id:'PO-301', project:'aurora', component:'Теплоотвод MX-21 · Rev A', iteration:'I-03', status:'Принято', kind:'good', accepted:28, quantity:28, defect:0, amount:44.9, complete:true, links:['LOT-039','TEST-12'] },
  { id:'PR-119', project:'aurora', component:'Кабельный жгут серии M', iteration:'I-03', status:'Нет КП', kind:'warning', accepted:0, quantity:50, defect:0, amount:12.6, complete:false, links:['EXC-04'] },
  { id:'PO-408', project:'orbit', component:'Плата управления · Rev C', iteration:'I-03', status:'Брак', kind:'risk', accepted:108, quantity:120, defect:12, amount:38.6, complete:true, links:['LOT-055','TEST-31','BC-041'] },
  { id:'PR-206', project:'orbit', component:'GNSS-приёмник NX-2', iteration:'I-04', status:'Нет протокола', kind:'warning', accepted:40, quantity:40, defect:0, amount:52.4, complete:false, links:['PO-412','EXC-07'] },
  { id:'PO-510', project:'nova', component:'Сенсор спектра SP-90', iteration:'I-02', status:'Принято', kind:'good', accepted:32, quantity:32, defect:0, amount:84.2, complete:true, links:['LOT-061','TEST-42'] },
  { id:'PO-516', project:'nova', component:'Оптическое окно · покрытие C2', iteration:'I-03', status:'Брак', kind:'risk', accepted:69, quantity:76, defect:7, amount:27.3, complete:true, links:['LOT-064','TEST-46','BC-052'] }
];
const changes = [
  { id:'BC-026', project:'aurora', title:'Повторное термоциклирование резервного образца', reason:'CR-08 · решение технического комитета', amount:24.8, date:'2026-10-03', status:'Согласовано' },
  { id:'BC-025', project:'aurora', title:'Переоценка открытого остатка PO-287 по USD', reason:'Курс +4,7% к базовому · валютный сценарий', amount:36.4, date:'2026-10-01', status:'Согласовано' },
  { id:'BC-024', project:'aurora', title:'Брак LOT-032 и повторная закупка датчиков', reason:'Рекламация SUP-12 · замена партии', amount:18.4, date:'2026-09-29', status:'На согласовании' },
  { id:'BC-023', project:'aurora', title:'Экономия по закупке теплоотводов', reason:'PO-301 · приёмка подтверждена', amount:-8.7, date:'2026-09-27', status:'Согласовано' },
  { id:'BC-041', project:'orbit', title:'Повторный выпуск платы управления Rev C', reason:'TEST-31 · несоответствие дорожек', amount:32, date:'2026-10-02', status:'На согласовании' },
  { id:'BC-040', project:'orbit', title:'Дополнительные EMC предиспытания', reason:'TEST-29 · расширение программы', amount:40, date:'2026-09-30', status:'Согласовано' },
  { id:'BC-052', project:'nova', title:'Нанесение покрытия оптического окна', reason:'TEST-46 · корректировка технологии', amount:12.8, date:'2026-10-02', status:'На согласовании' },
  { id:'BC-051', project:'nova', title:'Экономия на закупке сенсора спектра', reason:'PO-510 · предложение поставщика', amount:-14.8, date:'2026-09-28', status:'Согласовано' }
];
const tests = [
  { id:'TEST-17', project:'aurora', title:'Входной контроль датчиков TS-48', status:'Отклонение', kind:'risk', result:'199 из 240 принято · 41 отклонён', link:'LOT-032 / CR-08' },
  { id:'TEST-12', project:'aurora', title:'Контрольное термоциклирование', status:'Пройдено', kind:'good', result:'Тепловое сопротивление соответствует методике', link:'I-03 / PO-301' },
  { id:'TEST-31', project:'orbit', title:'Электрический контроль платы Rev C', status:'Отклонение', kind:'risk', result:'108 из 120 плат принято · требуется повторный выпуск', link:'LOT-055 / BC-041' },
  { id:'TEST-29', project:'orbit', title:'EMC предиспытания', status:'В работе', kind:'warning', result:'Повторный цикл после корректировки экранирования', link:'I-04 / BC-040' },
  { id:'TEST-42', project:'nova', title:'Калибровка измерительного канала', status:'Пройдено', kind:'good', result:'Погрешность в пределах допуска · 32 сенсора', link:'LOT-061 / PO-510' },
  { id:'TEST-46', project:'nova', title:'Адгезия покрытия оптического окна', status:'Отклонение', kind:'risk', result:'69 из 76 образцов принято · 7 отклонено', link:'LOT-064 / BC-052' }
];

const fullNames = { 'И. Панин':'Илья Панин', 'Е. Белова':'Елена Белова', 'А. Лебедев':'Андрей Лебедев', 'М. Воронова':'Мария Воронова', 'Д. Романов':'Дмитрий Романов', 'К. Миронов':'Кирилл Миронов', 'П. Орлов':'Павел Орлов', 'С. Ершов':'Сергей Ершов', 'О. Фёдорова':'Ольга Фёдорова', 'Н. Гребнева':'Наталья Гребнева', 'В. Ларина':'Вера Ларина', 'Р. Ким':'Роман Ким', 'Т. Соколова':'Татьяна Соколова', 'Л. Сергеева':'Людмила Сергеева', 'Е. Титова':'Екатерина Титова' };
const defaultUsers = [{ id:'admin', name:'Александр Ковалёв', email:'admin@epsilon.example', role:'admin', projects:projectIds, status:'active', timezone:'Europe/Vienna', notifications:'all' }];
planningCards.forEach((card, index) => {
  const shortName = card.owner.split(' · ')[0];
  const id = 'team-' + index;
  const role = card.owner.includes('закупки') ? 'procurement' : /руководитель|PMO/.test(card.owner) ? 'manager' : 'engineer';
  defaultUsers.push({ id, name:fullNames[shortName] ?? shortName, email:'team' + (index + 1) + '@epsilon.example', role, projects:[card.project], status:'active', timezone:'Europe/Vienna', notifications:'assigned' });
  card.ownerId = id;
});
defaultUsers.push({ id:'investor', name:'Анна Смирнова', email:'investor@epsilon.example', role:'investor', projects:projectIds, status:'active', timezone:'Europe/Vienna', notifications:'all' });
const initialBacklog = [
  { id:'backlog-aurora', project:'aurora', title:'Проверка сборки корпуса Rev D', ownerId:'team-0', due:'2026-10-26', plan:18, reason:'Проверить технологичность сборки и уточнить стоимость новой ревизии корпуса.' },
  { id:'backlog-orbit', project:'orbit', title:'Новая гипотеза фильтра навигации', ownerId:'team-5', due:'2026-11-05', plan:22, reason:'Оценить точность алгоритма на расширенном наборе сценариев.' },
  { id:'backlog-nova', project:'nova', title:'Оценка альтернативного сенсора', ownerId:'team-11', due:'2026-10-29', plan:15, reason:'Сравнить стоимость, доступность и характеристики альтернативного комплектующего.' }
].map((item,index)=>({...item, code:'BL-'+String(index+1).padStart(3,'0'), stage:'backlog', baseline:displayDate(item.due), forecast:displayDate(item.due), actual:0, commitments:0, eac:item.plan, owner:'', health:'ok', healthText:'Бюджетная заявка', links:[], proposed:true }));

function loadState() { const workspace=globalThis.epsilonAuth?.workspace;if(workspace)return {...workspace,...(workspace.planning?{tasks:workspace.planning.tasks,taskEvents:workspace.planning.taskEvents,projectTags:workspace.planning.projectTags}:{})};let data={};try { const stored = JSON.parse(localStorage.getItem(storageKey)); if(stored&&typeof stored==='object')data=stored; } catch {}return data; }
function validTask(task) { return task && /^[\w-]+$/.test(task.id) && projectIds.includes(task.project) && stages.some(stage => stage.id === task.stage) && typeof task.title === 'string' && task.title.length <= 140 && /^\d{4}-\d{2}-\d{2}$/.test(task.due) && ['plan','actual','commitments','eac'].every(key => task[key]===undefined||Number.isFinite(task[key]) && task[key] >= 0 && task[key] <= 100000); }
function validUser(user) { return user && /^[\w-]+$/.test(user.id) && typeof user.name === 'string' && typeof user.email === 'string' && (Object.hasOwn(roles,user.role)||['manager','engineer','procurement','investor'].includes(user.role)) && ['active','inactive','blocked','deleted'].includes(user.status) && Array.isArray(user.projects) && user.projects.every(id => projectIds.includes(id)); }
let tasks = Array.isArray(saved.tasks) && saved.tasks.length && saved.tasks.every(validTask) ? saved.tasks : structuredClone(planningCards);
initialBacklog.forEach(task=>{if(!tasks.some(item=>item.id===task.id))tasks.push(structuredClone(task));});
let users = Array.isArray(saved.users) && saved.users.length && saved.users.every(validUser) ? saved.users : structuredClone(defaultUsers);
let reportHistory = Array.isArray(saved.reports) ? saved.reports.filter(item => item && typeof item.id === 'string' && item.snapshot).slice(0, 25) : [];
let taskEvents = Array.isArray(saved.taskEvents) ? saved.taskEvents.filter(item => item && typeof item.taskId === 'string').slice(-100) : [];
let taskReminderLog=Array.isArray(saved.taskReminderLog)?saved.taskReminderLog.filter(x=>typeof x==='string').slice(-1000):[];
let projectTags = saved.projectTags && typeof saved.projectTags==='object' ? structuredClone(saved.projectTags) : {};
let selectedCoExecutorIds=[];
let selectedShareEditorIds=[];
let scope = projectIds.includes(saved.scope) ? saved.scope : 'all';
let period = saved.period === 'q4' ? 'q4' : 'q3';
let currentRoute = 'dashboard';
let editingTask = null;
let editingUser = null;
let selectedTask = null;
let sharingTaskId = null;
let dragId = null;
let toastTimer;
let drawerReturnFocus;
initializeAccess(saved);
if(!globalThis.epsilonAuth)for(const task of tasks)task.createdBy??=accessActor()?.id;
initializeTechnology(saved);
initializeProduction(saved);
if(saved.baseCurrency!=='RUB'||saved.access?.governanceVersion!==1)persist();
function applyPlanningState(planning){
  if(!planning)return;tasks=Array.isArray(planning.tasks)?structuredClone(planning.tasks):[];taskEvents=Array.isArray(planning.taskEvents)?structuredClone(planning.taskEvents):[];projectTags=planning.projectTags&&typeof planning.projectTags==='object'?structuredClone(planning.projectTags):{};
  if($('kanbanBoard'))render();
}
globalThis.applyPlanningState=applyPlanningState;

function persist() {
  if(globalThis.epsilonAuth)return true;
  try { localStorage.setItem(storageKey, JSON.stringify({ baseCurrency:'RUB', tasks, users, reports:reportHistory, taskEvents, taskReminderLog, scope, period, technology:technologyState(), production:productionData,access:accessState,projectCatalog:planningProjects })); return true; }
  catch { notify('Не удалось сохранить изменения в браузере. Экспортируйте снимок данных.'); return false; }
}
function notify(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200); }
function money(value) { const n = Math.abs(value); return n >= 1000 ? (n / 1000).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' млн ₽' : n.toLocaleString('ru-RU',{maximumFractionDigits:1})+' тыс. ₽'; }
function reportMoney(value) { return Number(value).toLocaleString('ru-RU',{maximumFractionDigits:2})+' тыс. руб.'; }
function normalizeRubDemoData(value,key='') {
  if(Array.isArray(value))return value.map(item=>normalizeRubDemoData(item));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,normalizeRubDemoData(item,name)]));
  if(typeof value!=='string')return value;
  if(['currency','baseCurrency'].includes(key)&&value==='EUR')return 'RUB';
  // Only legacy amount labels are relabelled; identifiers, URLs and quantities are preserved.
  return value.replace(/€\s*([\d.,]+)([KM])?/g,(_match,amount,unit)=>amount+(unit==='M'?' млн ₽':unit==='K'?' тыс. ₽':' ₽'));
}
function delta(value) { return (value < 0 ? '−' : '+') + money(value); }
function number(value) { return Number(value).toLocaleString('ru-RU', { maximumFractionDigits:1 }); }
function displayDate(value) { if (!value) return '—'; const [year, month, day] = value.slice(0,10).split('-'); return day + '.' + month + '.' + year; }
function isoDate(value) { const parts = value.split('.'); return parts.length === 3 ? parts.reverse().join('-') : value; }
function initials(value) { return value.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function scopeIds() { const allowed=accessScopeProjects();return scope==='all'?allowed:allowed.includes(scope)?[scope]:[]; }
function inScope(item) { return scopeIds().includes(item.project); }
function scopeName() { return scope === 'all' ? 'Весь портфель' : planningProjects[scope].code + ' · ' + planningProjects[scope].name; }
function taskOwner(task) { return users.find(user => user.id === task.ownerId)?.name ?? task.owner?.split(' · ')[0] ?? 'Не назначен'; }
function financial(id) { const project = planningProjects[id]; const forecast = period === 'q4' ? profiles[id].q4 : project; return { base:project.base, actual:forecast.actual, commitments:forecast.commitments, eac:forecast.eac }; }
function totals() { return scopeIds().reduce((sum,id) => { const values = financial(id); Object.keys(sum).forEach(key => sum[key] += values[key]); return sum; }, { base:0, actual:0, commitments:0, eac:0 }); }
function metric(label,value,note='',tone='') { return '<article class="metric"><span class="metric-label">' + escapeHtml(label) + '</span><strong class="metric-value ' + tone + '">' + escapeHtml(value) + '</strong><span class="metric-note">' + escapeHtml(note) + '</span></article>'; }
function financeMetrics() { const t = totals(); return [metric('Базовый план', money(t.base), 'Утверждённая версия B2'), metric('Факт', money(t.actual), number(t.actual/Math.max(1,t.base)*100) + '% освоения'), metric('Обязательства', money(t.commitments), 'Открытые заказы'), metric('Прогноз EAC', money(t.eac), 'Оценка до завершения','accent'), metric('Отклонение',delta(t.eac-t.base),number((t.base?t.eac/t.base-1:0)*100)+'% к базовому плану',t.eac>t.base?'negative':'positive')].join(''); }
function empty(message) { return '<div class="empty">' + escapeHtml(message) + '</div>'; }
function badge(label, kind='neutral') { return '<span class="status ' + kind + '">' + escapeHtml(label) + '</span>'; }

function donut(items, center, caption, label) {
  const sum = items.reduce((total,item) => total + item.value,0);
  let offset = 0;
  const circles = items.map(item => {
    const portion = sum ? item.value / sum * 100 : 0;
    const circle = '<circle cx="80" cy="80" r="61" pathLength="100" fill="none" stroke="' + item.color + '" stroke-width="12" stroke-dasharray="' + Math.max(0,portion - (portion > 2 ? .7 : 0)) + ' ' + (100 - Math.max(0,portion - (portion > 2 ? .7 : 0))) + '" stroke-dashoffset="' + -offset + '" transform="rotate(-90 80 80)"><title>' + escapeHtml(item.label + ': ' + item.display) + '</title></circle>';
    offset += portion;
    return item.value > 0 ? circle : '';
  }).join('');
  return '<div class="donut-wrap"><svg viewBox="0 0 160 160" role="img" aria-label="' + escapeHtml(label) + '"><circle cx="80" cy="80" r="61" fill="none" stroke="#25313b" stroke-width="12"/>' + circles + '</svg><div class="donut-center"><strong>' + escapeHtml(center) + '</strong><span>' + escapeHtml(caption) + '</span></div></div><div class="chart-legend">' + items.map(item => '<div class="legend-row"><span class="legend-name"><i class="legend-dot" style="--dot:' + item.color + '"></i>' + escapeHtml(item.label) + '</span><span class="legend-value">' + escapeHtml(item.display) + '</span></div>').join('') + '</div>';
}
function healthScores() {
  const t = totals();
  const cards = tasks.filter(inScope).filter(task => !task.proposed);
  const onTime = cards.filter(task => isoDate(task.forecast) <= isoDate(task.baseline)).length;
  const sum = scopeIds().reduce((s,id) => { const p = profiles[id]; s.qualityTotal += p.quality.total; s.accepted += p.quality.accepted; s.orders += p.totalOrders; s.readyOrders += p.readyOrders; s.tests += p.tests.total; s.passed += p.tests.passed; s.docs += p.docs.total; s.complete += p.docs.complete; return s; }, { qualityTotal:0, accepted:0, orders:0, readyOrders:0, tests:0, passed:0, docs:0, complete:0 });
  return [
    { label:'Бюджет', value:t.eac?Math.min(100, Math.round(t.base/t.eac*100)):0, detail:'Базовый план / EAC' },
    { label:'Сроки', value:cards.length ? Math.round(onTime/cards.length*100) : 0, detail:'Пакеты без сдвига прогнозного срока' },
    { label:'Качество', value:sum.qualityTotal?Math.round(sum.accepted/sum.qualityTotal*100):0, detail:'Принятые комплектующие / проверенные' },
    { label:'Закупки', value:sum.orders?Math.round(sum.readyOrders/sum.orders*100):0, detail:'Полные закупочные пакеты / все заказы' },
    { label:'Испытания', value:sum.tests?Math.round(sum.passed/sum.tests*100):0, detail:'Пройденные испытания / программа' },
    { label:'Документы', value:sum.docs?Math.round(sum.complete/sum.docs*100):0, detail:'Готовые документы / требуемые' }
  ];
}
function radar() {
  const scores = healthScores();
  const center = { x:185, y:136 }, radius = 82;
  const point = (index,value) => { const angle = -Math.PI/2 + index*Math.PI/3; return [center.x + Math.cos(angle)*radius*value/100, center.y + Math.sin(angle)*radius*value/100]; };
  const polygon = value => scores.map((item,index) => point(index,typeof value==='number'?value:item.value).join(',')).join(' ');
  const grids = [20,40,60,80,100].map(level => '<polygon points="' + polygon(level) + '" fill="none" stroke="#293b47" stroke-width="1"/>').join('');
  const axes = scores.map((item,index) => { const [x,y] = point(index,100); const [lx,ly] = point(index,136); const anchor = index===0||index===3?'middle':index<3?'start':'end'; return '<line x1="185" y1="136" x2="' + x + '" y2="' + y + '" stroke="#293b47"/><text x="' + lx + '" y="' + (ly+4) + '" text-anchor="' + anchor + '" class="radar-label">' + item.label + '<tspan x="' + lx + '" dy="14" fill="' + (item.value<60?'#f4ba4b':'#55e6d2') + '">' + item.value + '%</tspan></text>'; }).join('');
  const dots = scores.map((item,index) => { const [x,y] = point(index,item.value); return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#55e6d2"><title>' + item.label + ' ' + item.value + '% · ' + item.detail + '</title></circle>'; }).join('');
  const best = [...scores].sort((a,b)=>b.value-a.value)[0], worst = [...scores].sort((a,b)=>a.value-b.value)[0];
  $('radarChart').innerHTML = '<svg class="radar-graphic" viewBox="0 0 370 280" role="img" aria-label="Радарная диаграмма: ' + scores.map(item=>item.label+' '+item.value+'%').join(', ') + '">' + grids + axes + '<polygon points="' + polygon(80) + '" fill="none" stroke="#738697" stroke-dasharray="4 4"/><polygon points="' + polygon(null) + '" fill="#55e6d222" stroke="#55e6d2" stroke-width="2"/>' + dots + '</svg><div class="radar-legend"><span class="legend-name"><i class="legend-dot" style="--dot:#55e6d2"></i>Текущий профиль</span><span>┄ Цель 80%</span></div><div class="radar-summary"><div><small>СИЛЬНАЯ СТОРОНА</small><strong class="positive">' + best.label + ' · ' + best.value + '%</strong></div><div><small>ЗОНА ВНИМАНИЯ</small><strong style="color:var(--warn)">' + worst.label + ' · ' + worst.value + '%</strong></div></div>';
}
function renderDashboard() {
  const t=totals(), cards=tasks.filter(inScope);
  $('dashboardMetrics').innerHTML=financeMetrics();
  $('dashboardSubtitle').textContent=scope==='all'?'Расходы и готовность трёх проектов в едином портфеле.':planningProjects[scope].direction+' · завершение '+planningProjects[scope].finish;
  $('spendChart').innerHTML=donut([{label:'Факт',value:t.actual,color:'#55e6d2',display:money(t.actual)},{label:'Обязательства',value:t.commitments,color:'#63a7ff',display:money(t.commitments)},{label:'До завершения',value:Math.max(0,t.eac-t.actual-t.commitments),color:'#a999ff',display:money(Math.max(0,t.eac-t.actual-t.commitments))}],money(t.eac),'ПРОГНОЗ EAC','Факт, обязательства и остаток прогноза');
  $('statusChart').innerHTML=donut(stages.map(stage=>({label:stage.label,value:cards.filter(task=>task.stage===stage.id).length,color:stage.color,display:String(cards.filter(task=>task.stage===stage.id).length)})),String(cards.length),'ПАКЕТОВ РАБОТ','Распределение пакетов работ по статусам');
  $('workCount').textContent=cards.length+' ПАКЕТОВ';
  radar();
  $('projectCards').innerHTML=scopeIds().map(id=>{const project=planningProjects[id],f=financial(id),progress=Math.round(f.actual/Math.max(1,f.eac)*100);return '<button class="project-row" data-project="'+id+'" type="button"><div class="project-row-top"><span class="project-name">'+project.name+'<span>'+project.code+'</span></span><span class="project-finance">'+money(f.base)+' / <span class="'+(f.eac>f.base?'negative':'positive')+'">'+money(f.eac)+'</span></span></div><div class="budget-track"><span style="width:'+progress+'%;background:var(--accent)"></span><span style="width:'+(f.commitments/Math.max(1,f.eac)*100)+'%;background:var(--blue)"></span></div><div class="project-row-meta"><span>Освоено '+progress+'% · '+tasks.filter(task=>task.project===id).length+' пакетов</span><span>До '+project.finish+' ↗</span></div></button>';}).join('');
  const attention=cards.filter(task=>task.stage==='decision'||task.health==='risk'&&task.stage!=='closed').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  $('attentionCount').textContent=attention.length+' ПАКЕТОВ';
  $('attentionList').innerHTML=attention.length?attention.map(task=>'<div class="list-row clickable" data-task="'+escapeHtml(task.id)+'" tabindex="0" role="button"><div class="list-row-top"><h3>'+escapeHtml(task.title)+'</h3>'+badge(task.stage==='decision'?'РЕШЕНИЕ':'РИСК','warning')+'</div><p>'+escapeHtml(task.reason)+'</p><span class="unit">'+planningProjects[task.project].code+' · '+displayDate(task.due)+' · EAC '+money(task.eac)+'</span></div>').join(''):empty('Открытых рисков и решений нет');
}
const taskKindLabels={epic:'Эпик',task:'Задача',subtask:'Подзадача',fix:'Фикс'};
function projectTagList(project){
  if(!projectTags[project]){
    const departments=accessState.departments.filter(d=>d.projects?.includes(project));
    const members=users.filter(u=>u.status==='active'&&(u.role==='leader'||u.projects?.includes(project)));
    const palette=['#55e6d2','#63a7ff','#a999ff','#f4ba4b','#f47b7b','#4ddc8b'];
    projectTags[project]=[...departments.map((d,i)=>({id:'department-'+d.id,kind:'department',name:d.name,color:palette[i%palette.length],departmentId:d.id})),...members.map((u,i)=>({id:'user-'+u.id,kind:'user',name:u.name,color:palette[i%palette.length],userId:u.id,active:true}))];
  }
  return projectTags[project];
}
function taskTagMarkup(task,limit=4){return (task.tags??[]).map(id=>projectTagList(task.project).find(t=>t.id===id)).filter(Boolean).slice(0,limit).map(tag=>'<span class="task-tag"><i style="--tag-color:'+escapeHtml(tag.color)+'"></i>'+escapeHtml(tag.name)+'</span>').join('');}
function taskCard(task) {
  const color=task.stage==='closed'?'#4ddc8b':task.stage==='decision'?'#f4ba4b':task.stage==='verification'?'#55e6d2':'#63a7ff';
  const coExecutors=(task.coExecutorIds??[]).map(id=>users.find(u=>u.id===id)?.name).filter(Boolean);
  const hierarchy=task.parentId?tasks.find(t=>t.id===task.parentId):null;
  const due=new Date(task.due+'T00:00:00');
  return '<button class="kanban-card task-card" draggable="'+(accessCanMoveTask(task)?'true':'false')+'" data-task="'+escapeHtml(task.id)+'" style="--card-color:'+color+'" type="button" aria-label="Открыть '+escapeHtml(task.title)+'"><span class="card-project">'+escapeHtml(planningProjects[task.project].code)+' · '+escapeHtml(task.code??'')+'<span class="grip" aria-hidden="true">⠿</span></span><div class="task-card-meta"><span>'+escapeHtml(taskKindLabels[task.kind]??'Задача')+'</span>'+(task.taskType==='recurring'?'<span>Регулярная</span>':'')+'</div><h3>'+escapeHtml(task.title)+'</h3>'+(hierarchy?'<p class="task-parent">↳ '+escapeHtml(hierarchy.title)+'</p>':'')+(task.description||task.reason?'<p class="task-description">'+escapeHtml(task.description||task.reason)+'</p>':'')+'<div class="task-tags">'+taskTagMarkup(task)+'</div><span class="card-owner"><span>'+escapeHtml(taskOwner(task))+(coExecutors.length?' · +'+coExecutors.length:'')+'</span><time datetime="'+task.due+'">'+displayDate(task.due).slice(0,5)+'</time></span>'+(due<new Date(new Date().toDateString())&&task.stage!=='closed'?'<span class="task-late">Просрочено</span>':'')+'</button>';
}
function renderPlanning() {
  const query=$('taskSearch').value.trim().toLocaleLowerCase('ru');
  const all=tasks.filter(inScope).filter(accessTaskVisible),cards=all.filter(task=>(task.title+' '+task.code+' '+taskOwner(task)+' '+planningProjects[task.project].code).toLocaleLowerCase('ru').includes(query));
  const open=all.filter(task=>task.stage!=='closed'),overdue=open.filter(task=>task.due<new Date().toISOString().slice(0,10)),verification=open.filter(task=>task.stage==='verification'),blocked=open.filter(task=>task.stage==='decision');
  $('boardScope').textContent=scopeName(); $('boardCount').textContent=cards.length+' задач';
  $('boardStats').innerHTML='<span>В работе<strong>'+open.length+'</strong></span><span>Скоро срок<strong>'+all.filter(task=>task.stage!=='closed'&&task.due>=new Date().toISOString().slice(0,10)&&task.due<=new Date(Date.now()+7*86400000).toISOString().slice(0,10)).length+'</strong></span><span>На верификации<strong>'+verification.length+'</strong></span><span>Просрочено / блокеры<strong class="'+(overdue.length+blocked.length?'negative':'')+'">'+(overdue.length+blocked.length)+'</strong></span>';
  $('kanbanBoard').innerHTML=stages.map(stage=>{const items=cards.filter(task=>task.stage===stage.id);return '<section class="kanban-column" aria-label="'+stage.label+'"><div class="kanban-column-head" style="--stage-color:'+stage.color+'"><h2>'+stage.label+'</h2><span>'+String(items.length).padStart(2,'0')+'</span></div><div class="kanban-cards" data-drop-stage="'+stage.id+'">'+items.map(taskCard).join('')+(stage.id==='backlog'?'<button class="backlog-add" data-add-task type="button">+ Создать задачу</button>':'')+(!items.length&&stage.id!=='backlog'?empty('Задач пока нет'):'')+'</div></section>';}).join('');
}
function renderPurchases() {
  const rows=purchases.filter(inScope),filter=$('purchaseFilter').value;
  const visible=rows.filter(item=>filter==='all'||filter==='incomplete'&&!item.complete||filter==='defect'&&item.defect>0);
  $('purchaseMetrics').innerHTML=[metric('Закупок в реестре',rows.length,'Демонстрационная выборка'),metric('Сумма выборки',money(rows.reduce((sum,item)=>sum+item.amount,0)),'Сумма заказов и заявок'),metric('Полные пакеты',rows.filter(item=>item.complete).length,'Из '+rows.length+' закупок','positive'),metric('Неполные пакеты',rows.filter(item=>!item.complete).length,'Требуется комплект документов'),metric('Отклонено единиц',rows.reduce((sum,item)=>sum+item.defect,0),'По входному контролю','negative')].join('');
  $('purchaseCount').textContent=visible.length+' ЗАПИСЕЙ';
  $('purchaseRows').innerHTML=visible.length?visible.map(item=>'<tr class="clickable" data-purchase="'+item.id+'" tabindex="0"><td><strong>'+item.id+'</strong><small>'+item.component+'</small></td><td class="mono">'+planningProjects[item.project].code+'<small>'+item.iteration+'</small></td><td>'+badge(item.status,item.kind)+'</td><td class="mono">'+item.accepted+' / '+item.quantity+'</td><td class="mono '+(item.defect?'negative':'')+'">'+(item.defect||'—')+'</td><td class="mono">'+money(item.amount)+'</td><td>'+badge(item.complete?'Полный':'Неполный',item.complete?'good':'warning')+'</td><td class="trace-cell">'+item.links.join(' · ')+'</td></tr>').join(''):'<tr><td colspan="8">'+empty('Нет закупок с выбранным фильтром')+'</td></tr>';
}
function growthSources() {
  const values=[];
  for(const id of scopeIds()) {
    if(id==='aurora') { dashboardData[period].waterfall.filter(item=>!['base','total'].includes(item.kind)).forEach(item=>values.push({name:item.name,value:item.value})); }
    if(id==='orbit') values.push({name:'Повторный выпуск платы',value:period==='q4'?52.2:32},{name:'EMC предиспытания',value:period==='q4'?72:40});
    if(id==='nova') values.push({name:'Корректировка покрытия',value:period==='q4'?46.8:12.8},{name:'Экономия по сенсорам',value:-14.8});
  }
  const grouped=[];
  values.forEach(item=>{ const match=grouped.find(other=>other.name===item.name); if(match)match.value+=item.value;else grouped.push({...item}); });
  const t=totals(); return [{name:'Базовый план',value:t.base,kind:'base'},...grouped.map(item=>({...item,kind:item.value<0?'saving':'growth'})),{name:'Прогноз EAC',value:t.eac,kind:'total'}];
}
function renderBudget() {
  $('budgetMetrics').innerHTML=financeMetrics();
  const rows=growthSources(),max=Math.max(1,totals().eac);
  $('waterfall').innerHTML=rows.map(item=>'<div class="waterfall-row"><span>'+escapeHtml(item.name)+'</span><div class="waterfall-bar"><span style="width:'+Math.max(1,Math.abs(item.value)/max*100)+'%;background:'+(item.kind==='base'?'var(--blue)':item.kind==='total'?'var(--accent)':item.kind==='saving'?'var(--good)':'var(--bad)')+'"></span></div><strong class="'+(item.kind==='growth'?'negative':item.kind==='saving'?'positive':'')+'">'+(['growth','saving'].includes(item.kind)?delta(item.value):money(item.value))+'</strong></div>').join('');
  $('iterationBudget').innerHTML=tasks.filter(inScope).filter(task=>!task.proposed).map(task=>'<div class="list-row clickable" data-task="'+escapeHtml(task.id)+'" tabindex="0" role="button"><div class="list-row-top"><h3>'+escapeHtml(task.code+' · '+task.title)+'</h3><span class="mono '+(task.eac>task.plan?'negative':'positive')+'">'+delta(task.eac-task.plan)+'</span></div><div class="budget-track"><span style="width:'+Math.min(100,task.actual/Math.max(1,task.eac)*100)+'%;background:var(--accent)"></span><span style="width:'+Math.min(100,task.commitments/Math.max(1,task.eac)*100)+'%;background:var(--blue)"></span></div><p>'+planningProjects[task.project].code+' · план '+money(task.plan)+' · EAC '+money(task.eac)+'</p></div>').join('');
  const proposals=tasks.filter(inScope).filter(task=>task.proposed&&!task.superseded);
  $('proposedBudget').innerHTML=proposals.length?proposals.map(task=>'<div class="list-row clickable" data-task="'+escapeHtml(task.id)+'" tabindex="0" role="button"><div class="list-row-top"><h3>'+escapeHtml(task.title)+'</h3><strong class="mono">'+money(task.plan)+'</strong></div><p>'+planningProjects[task.project].code+' · '+stages.find(stage=>stage.id===task.stage).label+' · '+escapeHtml(taskOwner(task))+'</p></div>').join(''):empty('Новых бюджетных заявок нет. Добавьте карточку в бэклог в разделе «Планирование».');
}
function renderQuality() {
  const q=scopeIds().reduce((sum,id)=>{const p=profiles[id];sum.gross+=p.quality.gross;sum.recovery+=p.quality.recovery;sum.passed+=p.tests.passed;sum.total+=p.tests.total;return sum;},{gross:0,recovery:0,passed:0,total:0});
  const defects=purchases.filter(inScope).filter(item=>item.defect);
  $('qualityMetrics').innerHTML=[metric('Валовой брак',money(q.gross),'Стоимость отклонений','negative'),metric('К возмещению',money(q.recovery),'Открытые рекламации'),metric('Чистые потери',money(q.gross-q.recovery),'После ожидаемых возвратов','negative'),metric('Рекламации',defects.length,'Открытые случаи'),metric('Испытания',q.passed+' / '+q.total,'Пройдено по программе','positive')].join('');
  $('qualityList').innerHTML=defects.map(item=>'<div class="list-row clickable" data-purchase="'+item.id+'" tabindex="0" role="button"><div class="list-row-top"><h3>'+item.component+'</h3>'+badge('ОТКЛОНЕНИЕ','risk')+'</div><p>'+item.defect+' из '+item.quantity+' единиц отклонено · '+planningProjects[item.project].code+'</p><span class="unit">'+item.id+' / '+item.links.join(' / ')+'</span></div>').join('')||empty('Отклонений не найдено');
  $('testList').innerHTML=tests.filter(inScope).map(test=>'<div class="list-row"><div class="list-row-top"><h3>'+test.title+'</h3>'+badge(test.status,test.kind)+'</div><p>'+test.result+'</p><span class="unit">'+test.id+' / '+test.link+'</span></div>').join('');
}
function renderChanges() {
  const rows=changes.filter(inScope),t=totals();
  $('changeMetrics').innerHTML=[metric('Отклонение EAC',delta(t.eac-t.base),'К базовому бюджету',t.eac>t.base?'negative':'positive'),metric('Корректировок',rows.length,'В журнале изменений'),metric('Согласовано',rows.filter(row=>row.status==='Согласовано').length,'Зафиксированные решения'),metric('На согласовании',rows.filter(row=>row.status!=='Согласовано').length,'Требуют решения'),metric('Экономия',money(-rows.filter(row=>row.amount<0).reduce((sum,row)=>sum+row.amount,0)),'Подтверждённые сокращения','positive')].join('');
  $('changeList').innerHTML=rows.map(row=>'<div class="list-row"><div class="list-row-top"><h3>'+row.id+' · '+row.title+'</h3><strong class="mono '+(row.amount>0?'negative':'positive')+'">'+delta(row.amount)+'</strong></div><p>'+row.reason+'</p><div class="list-row-top" style="margin-top:10px"><span class="unit">'+planningProjects[row.project].code+' · '+displayDate(row.date)+'</span>'+badge(row.status,row.status==='Согласовано'?'good':'warning')+'</div></div>').join('');
}
function renderUsers() {
  renderAccessPortal();
}
function renderReports() {
  const leader=accessActor()?.role==='leader',visible=reportHistory.filter(report=>(leader||report.snapshot.projects?.length&&report.snapshot.projects.every(p=>accessCan('reports',p.id)))&&(scope==='all'||report.snapshot.projects.some(project=>project.id===scope)));
  $('reportHistory').innerHTML=visible.length?visible.map(report=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(report.id+' · '+report.name)+'</h3>'+(leader?'<button class="btn small" data-report="'+escapeHtml(report.id)+'" type="button">↓ Скачать снова</button>':'')+'</div><p>'+escapeHtml(report.snapshot.scopeName)+' · '+new Date(report.createdAt).toLocaleString('ru-RU')+' · '+(report.snapshot.reportKind==='production'?displayDate(report.snapshot.production.from)+' — '+displayDate(report.snapshot.production.to):report.snapshot.period.toUpperCase())+'</p></div>').join(''):empty('Отчётов в доступном контуре пока нет. Полные выгрузки формирует руководитель.');
}

function render() {
  const allowed=accessScopeProjects();if(scope!=='all'&&!allowed.includes(scope)||scope==='all'&&allowed.length===1)scope=allowed[0]??'all';
  $('projectSelect').value=scope; $('periodSelect').value=period;
  $('sidebarScope').textContent=scope==='all'?'Весь портфель':planningProjects[scope].code;
  $('sidebarScopeNote').textContent=scope==='all'?allowed.length+' проектов · доступный контур':planningProjects[scope].name;
  document.querySelectorAll('.scope-label').forEach(label=>label.textContent=scope==='all'?'ДОСТУПНЫЕ ПРОЕКТЫ / '+allowed.length:planningProjects[scope].code+' / '+planningProjects[scope].direction.toUpperCase());
  $('snapshotDate').textContent=globalThis.epsilonAuth?'Тестовые данные · контур задач в PostgreSQL':period==='q3'?'Демонстрационные данные · 04.10.2026':'Прогнозный сценарий · Q4 2026';
  const renderers={dashboard:renderDashboard,planning:renderPlanning,purchases:renderPurchases,budget:renderBudget,quality:renderQuality,changes:renderChanges,admin:renderUsers,reports:renderReports,production:renderProduction,testing:renderTestingWorkspace};
  if(accessCanRoute(currentRoute))renderers[currentRoute]?.();
  if(currentRoute==='purchases')$('techPurchaseInbox').innerHTML=renderTechRequestList(techRequests.filter(inScope).filter(r=>r.type==='purchase'));
  if(currentRoute==='quality')$('techVerificationInbox').innerHTML=empty('Заявки и протоколы ведутся в разделе «Испытания». Для доступа требуется соответствующее полномочие.');
  renderAccessUI();
  if(currentRoute==='production')$('snapshotDate').textContent='Демонстрационный производственный срез · '+displayDate(productionAsOf);
}
function routeUrl(route) { return '/'+route+'?project='+scope+'&period='+period; }
function parseUrl() {
  const file=location.protocol==='file:';
  const raw=file?location.hash.replace(/^#/,''):location.pathname+location.search;
  const parsed=new URL(raw||'/dashboard', 'https://epsilon.local');
  const route=parsed.pathname.replace(/^\/+|\/+$/g,'');
  const project=parsed.searchParams.get('project'),p=parsed.searchParams.get('period');
  if(project==='all'||projectIds.includes(project))scope=project;
  if(p==='q3'||p==='q4')period=p;
  return route in routes?route:'dashboard';
}
function navigate(route,options={}) {
  if(!(route in routes))return;
  if(route==='users')route='admin';
  if(!accessCanRoute(route))route=accessHome();
  const allowed=accessScopeProjects(route);if(scope!=='all'&&!allowed.includes(scope)||scope==='all'&&allowed.length===1)scope=allowed[0]??'all';
  closeDrawer(); currentRoute=route;
  render();
  $('periodSelect').closest('label').hidden=['production','admin','access-denied'].includes(route);
  $('snapshotDate').textContent=globalThis.epsilonAuth?'Тестовые данные · контур задач в PostgreSQL':route==='production'?'Демонстрационный производственный срез · '+displayDate(productionAsOf):period==='q3'?'Демонстрационные данные · 04.10.2026':'Прогнозный сценарий · Q4 2026';
  document.querySelectorAll('[data-view]').forEach(view=>view.hidden=view.dataset.view!==route);
  document.querySelectorAll('.sidebar nav [data-route]').forEach(link=>{if(link.dataset.route===route)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  $('currentSection').textContent=routes[route]; document.title='ЭПСИЛОН · '+routes[route];
  if(options.history!==false) {
    const method=options.replace?'replaceState':'pushState';
    if(location.protocol==='file:')history[method]({},'', '#'+routeUrl(route));else history[method]({},'',routeUrl(route));
  }
  window.scrollTo({top:0,behavior:'instant'});
}
function selectProject(id) {
  if(id!=='all'&&!accessScopeProjects().includes(id)){notify('Нет допуска к этому проекту.');return;}
  scope=id; $('taskSearch').value=''; $('purchaseFilter').value='all'; $('userSearch').value=''; persist(); navigate(currentRoute,{replace:true});
}

function fillOwners(project,selectedId) {
  const available=users.filter(user=>user.status==='active'&&accessProjects(user).includes(project)&&accessCan('planning',project,'read',user));
  $('taskForm').elements.ownerId.innerHTML=available.map(user=>'<option value="'+escapeHtml(user.id)+'">'+escapeHtml(user.name)+'</option>').join('');
  $('coExecutorSelect').innerHTML='<option value="">Добавить сотрудника</option>'+available.map(user=>'<option value="'+escapeHtml(user.id)+'">'+escapeHtml(user.name)+'</option>').join('');
  if(available.some(user=>user.id===selectedId))$('taskForm').elements.ownerId.value=selectedId;
  else if(available.length)$('taskForm').elements.ownerId.value=available[0].id;
}
function fillTaskParents(project,kind,selectedId){
  const parentKinds={epic:[],task:['epic'],subtask:['task'],fix:['task','subtask']};
  const list=tasks.filter(t=>t.project===project&&(parentKinds[kind]??[]).includes(t.kind));
  $('taskForm').elements.parentId.innerHTML='<option value="">Без родительской задачи</option>'+list.map(t=>'<option value="'+escapeHtml(t.id)+'">'+escapeHtml((taskKindLabels[t.kind]??'')+' · '+t.title)+'</option>').join('');
  $('taskForm').elements.parentId.value=list.some(t=>t.id===selectedId)?selectedId:'';
}
function renderCoExecutorChips(){
  const project=$('taskForm').elements.project.value;
  $('coExecutorChips').innerHTML=selectedCoExecutorIds.map(id=>users.find(u=>u.id===id)).filter(Boolean).map(u=>'<span class="task-chip">'+escapeHtml(u.name)+'<button type="button" data-remove-coexecutor="'+escapeHtml(u.id)+'" aria-label="Убрать '+escapeHtml(u.name)+'">×</button></span>').join('');
  const ownerId=$('taskForm').elements.ownerId.value;for(const option of $('coExecutorSelect').options)option.disabled=option.value===ownerId||selectedCoExecutorIds.includes(option.value);
}
function renderTaskTags(project,selected=[]){
  const selectedSet=new Set(selected),tags=projectTagList(project);
  $('taskTagList').innerHTML=tags.map(tag=>'<label class="task-tag-choice"><input type="checkbox" name="taskTags" value="'+escapeHtml(tag.id)+'"'+(selectedSet.has(tag.id)?' checked':'')+' /><i style="--tag-color:'+escapeHtml(tag.color)+'"></i><span>'+escapeHtml(tag.name)+'</span></label>').join('')||empty('Метки проекта ещё не настроены.');
}
function localDateTime(value){if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function openTaskForm(id=null) {
  const original=id?tasks.find(t=>t.id===id):null;
  if(id?!accessCanManageTask(original):!accessProjects().some(p=>accessCan('planning',p,'write'))){notify('Редактировать задачу может её создатель или пользователь с переданным правом.');return;}
  editingTask=id;closeDrawer();const form=$('taskForm');form.reset();
  const task=id?tasks.find(item=>item.id===id):null,allowed=accessProjects().filter(p=>accessCan('planning',p,'write'));if(task&&accessCan('planning',task.project,'read')&&!allowed.includes(task.project))allowed.unshift(task.project);
  form.elements.project.innerHTML=allowed.map(p=>'<option value="'+p+'">'+escapeHtml(planningProjects[p].code)+'</option>').join('');
  form.elements.project.value=task?.project??(allowed.includes(scope)?scope:allowed[0]??'');form.elements.project.disabled=Boolean(task);
  fillOwners(form.elements.project.value,task?.ownerId);form.elements.title.value=task?.title??'';form.elements.kind.value=task?.kind??'task';
  form.elements.parentId.value='';fillTaskParents(form.elements.project.value,form.elements.kind.value,task?.parentId);
  form.elements.startDate.value=task?.startDate??'';form.elements.due.value=task?.due??new Date().toISOString().slice(0,10);
  form.elements.due.readOnly=Boolean(task&&!accessCanSetDeadline(task.project)&&!accessCanManageTask(task));
  form.elements.taskType.value=task?.taskType??'one_off';form.elements.cadence.value=task?.cadence??'weekly';form.elements.activateDaysBefore.value=String(task?.activateDaysBefore??3);
  form.elements.description.value=task?.description??task?.reason??'';selectedCoExecutorIds=[...(task?.coExecutorIds??[])];renderCoExecutorChips();
  $('taskReminderRows').innerHTML=(task?.reminders?.length?task.reminders:['']).map(value=>'<div class="task-reminder-row"><input name="reminders" type="datetime-local" aria-label="Время напоминания" value="'+escapeHtml(localDateTime(value))+'" /><button class="icon-button remove-reminder" type="button" aria-label="Удалить напоминание">×</button></div>').join('');
  renderTaskTags(form.elements.project.value,task?.tags??[]);
  document.querySelectorAll('.recurring-option').forEach(el=>el.hidden=form.elements.taskType.value!=='recurring');
  $('taskDialogTitle').textContent=task?'Редактировать задачу':'Новая задача';$('saveTask').textContent=task?'Сохранить':'Создать задачу';$('taskFormError').hidden=true;
  $('taskFormNote').textContent=task?.taskType==='recurring'?'Завершение регулярной задачи создаст следующее выполнение по расписанию.':'Регулярная задача активируется на доске за заданное количество дней до срока.';
  $('taskDialog').showModal();form.elements.title.focus();
}
async function saveTask(event) {
  event.preventDefault();const form=$('taskForm');if(!form.reportValidity())return;
  const existing=editingTask?tasks.find(t=>t.id===editingTask):null,project=existing?.project??form.elements.project.value;
  if(existing?!accessCanManageTask(existing):!accessCan('planning',project,'write')){notify('Полномочия на задачу отозваны.');return;}
  const ownerId=form.elements.ownerId.value,owner=users.find(user=>user.id===ownerId);if(!owner||owner.status!=='active'||!accessProjects(owner).includes(project)){notify('Ответственный должен иметь активный доступ к проекту.');return;}
  const reminders=[...form.querySelectorAll('[name="reminders"]')].map(input=>input.value).filter(Boolean).map(value=>new Date(value).toISOString());
  const tags=[...form.querySelectorAll('[name="taskTags"]:checked')].map(input=>input.value);
  const payload={operation:existing?'update':'create',id:existing?.id,project,title:form.elements.title.value.trim(),kind:form.elements.kind.value,parentId:form.elements.parentId.value||null,ownerId,coExecutorIds:selectedCoExecutorIds.filter(id=>id!==ownerId),startDate:form.elements.startDate.value,due:form.elements.due.value,taskType:form.elements.taskType.value,cadence:form.elements.cadence.value,activateDaysBefore:Number(form.elements.activateDaysBefore.value),reminders,tags,description:form.elements.description.value.trim(),stage:existing?.stage};
  const button=$('saveTask');button.disabled=true;$('taskFormError').hidden=true;
  try{
    if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate(payload);applyPlanningState(result.planning);}
    else if(existing)Object.assign(existing,payload,{reason:payload.description});
    else{
      const department=accessState.departments.find(d=>d.id===accessActor()?.departmentId),autoTag=projectTagList(project).find(t=>t.kind==='department'&&t.departmentId===department?.id);
      const task={...payload,id:uid('task'),code:'TASK-'+String(tasks.length+1).padStart(3,'0'),stage:'backlog',plan:0,actual:0,commitments:0,eac:0,owner:owner.name,createdBy:accessActor().id,departmentId:accessActor().departmentId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};if(autoTag&&!task.tags.includes(autoTag.id))task.tags.push(autoTag.id);tasks.push(task);
    }
    const edited=Boolean(existing);persist();$('taskDialog').close();$('taskSearch').value='';render();notify(edited?'Изменения задачи сохранены.':'Задача создана в бэклоге.');
  }catch(error){$('taskFormError').textContent=error.message;$('taskFormError').hidden=false;}
  finally{button.disabled=false;}
}
async function saveTaskDeadline(id){
  const task=tasks.find(item=>item.id===id),due=$('taskDeadline')?.value??'',reason=$('taskDeadlineReason')?.value.trim()??'';
  if(!task||!accessCanSetDeadline(task.project)){notify('Нет права менять срок этой задачи.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||task.startDate&&task.startDate>due||!reason||reason.length>500){notify('Проверьте срок и укажите основание изменения (до 500 символов).');return;}
  try{
    if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate({operation:'deadline',id,due,reason});applyPlanningState(result.planning);}
    else{task.due=due;task.forecast=due;task.updatedAt=new Date().toISOString();}
    persist();render();openTask(id);notify('Срок задачи изменён. Основание записано в журнал.');
  }catch(error){notify(error.message);}
}
async function moveTask(id,stage) {
  const task=tasks.find(item=>item.id===id);if(!task||!stages.some(item=>item.id===stage)||task.stage===stage)return;
  if(!accessCanMoveTask(task)){notify('Нет права менять статус этой задачи.');return;}
  try{
    if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate({operation:'move',id,stage});applyPlanningState(result.planning);}
    else{const from=task.stage;task.stage=stage;taskEvents.push({taskId:id,from,to:stage,at:new Date().toISOString()});taskEvents=taskEvents.slice(-100);if(stage==='closed'&&task.taskType==='recurring'){const next={...structuredClone(task),id:uid('task'),code:'TASK-'+String(tasks.length+1).padStart(3,'0'),stage:'backlog',due:nextRecurringDue(task.due,task.cadence),reminders:[],createdAt:new Date().toISOString()};tasks.push(next);}}
    persist();render();notify('«'+task.title+'» → '+stages.find(item=>item.id===stage).label);if(selectedTask===id&&$('detailDrawer').classList.contains('open'))openTask(id);
  }catch(error){notify(error.message);}
}
function nextRecurringDue(due,cadence){const value=new Date(due+'T12:00:00Z');if(cadence==='monthly')value.setUTCMonth(value.getUTCMonth()+1);else value.setUTCDate(value.getUTCDate()+7);return value.toISOString().slice(0,10);}

function openDrawer(kicker,title,body) {
  if(!$('detailDrawer').classList.contains('open'))drawerReturnFocus=document.activeElement;
  $('drawerKicker').textContent=kicker;$('drawerTitle').textContent=title;$('drawerBody').innerHTML=body;
  $('drawerBody').querySelectorAll('[data-tech-result]').forEach(el=>{const r=techRequests.find(x=>x.id===el.dataset.techResult);el.hidden=!r||!accessCan('testing',r.project,'verify');});
  const task=selectedTask&&tasks.find(t=>t.id===selectedTask);
  if(task){if(!accessCanMoveTask(task))$('drawerBody').querySelectorAll('#taskStage').forEach(el=>el.hidden=true);if(!accessCanManageTask(task))$('drawerBody').querySelectorAll('[data-edit-task],[data-delete-task]').forEach(el=>el.hidden=true);if(!accessCanShareTask(task))$('drawerBody').querySelectorAll('[data-share-task]').forEach(el=>el.hidden=true);}
  $('detailDrawer').inert=false;$('detailDrawer').classList.add('open');$('detailDrawer').setAttribute('aria-hidden','false');$('closeDrawer').focus();
}
function closeDrawer() {
  const wasOpen=$('detailDrawer').classList.contains('open');$('detailDrawer').classList.remove('open');$('detailDrawer').setAttribute('aria-hidden','true');$('detailDrawer').inert=true;selectedTask=null;
  if(wasOpen&&drawerReturnFocus?.isConnected)drawerReturnFocus.focus();
}
function detailRows(rows) { return '<div class="detail-grid">'+rows.map(([label,value])=>'<div class="detail-row"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>').join('')+'</div>'; }
function openTask(id) {
  const task=tasks.find(item=>item.id===id);if(!task)return;selectedTask=id;
  if(!accessTaskVisible(task)){notify('Нет допуска к этой карточке.');return;}
  const lastEvents=taskEvents.filter(item=>item.taskId===id).slice(-5).reverse(),parent=task.parentId?tasks.find(t=>t.id===task.parentId):null,coExecutors=(task.coExecutorIds??[]).map(uid=>users.find(u=>u.id===uid)?.name).filter(Boolean);
  const creator=users.find(u=>u.id===task.createdBy)?.name??'Пользователь системы',manage=accessCanManageTask(task),share=accessCanShareTask(task),canMove=accessCanMoveTask(task),canSetDeadline=accessCanSetDeadline(task.project);
  const actions=manage?'<div class="task-owner-actions"><button class="btn primary" data-edit-task="'+escapeHtml(task.id)+'" type="button">Редактировать</button><button class="btn danger" data-delete-task="'+escapeHtml(task.id)+'" type="button">Удалить</button>'+(share?'<button class="icon-button task-share-button" data-share-task="'+escapeHtml(task.id)+'" type="button" aria-label="Поделиться правами" title="Поделиться правами"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg></button>':'')+'</div>':'';
  const deadlineEditor=canSetDeadline&&!manage?'<section class="deadline-editor"><label class="control"><span>Новый срок</span><input id="taskDeadline" type="date" min="'+escapeHtml(task.startDate??'')+'" value="'+escapeHtml(task.due)+'" required /></label><label class="control"><span>Основание изменения</span><input id="taskDeadlineReason" maxlength="500" placeholder="Почему изменяется срок" required /></label><button class="btn" data-save-deadline="'+escapeHtml(task.id)+'" type="button">Сохранить срок</button></section>':'';
  const body=detailRows([['Проект',planningProjects[task.project].code],['Тип',taskKindLabels[task.kind]??'Задача'],['Родитель',parent?.title??'—'],['Создал',creator],['Ответственный',taskOwner(task)],['Соисполнители',coExecutors.join(', ')||'—'],['Начало / срок',(task.startDate?displayDate(task.startDate)+' / ':'')+displayDate(task.due)],['Повторение',task.taskType==='recurring'?(task.cadence==='monthly'?'Ежемесячно':'Еженедельно'):'Разовая'],['Напоминания',(task.reminders??[]).map(at=>new Date(at).toLocaleString('ru-RU')).join(' · ')||'Нет']])+'<div class="task-tags">'+taskTagMarkup(task,20)+'</div>'+(task.description||task.reason?'<div class="drawer-note">'+escapeHtml(task.description||task.reason)+'</div>':'')+(canMove?'<label class="control"><span>Статус</span><select id="taskStage">'+stages.map(stage=>'<option value="'+stage.id+'" '+(stage.id===task.stage?'selected':'')+'>'+stage.label+'</option>').join('')+'</select></label>':'')+deadlineEditor+actions+(lastEvents.length?'<div style="margin-top:24px"><span class="eyebrow">ИСТОРИЯ</span>'+lastEvents.map(item=>'<div class="list-row"><h3>'+stages.find(stage=>stage.id===item.from)?.label+' → '+stages.find(stage=>stage.id===item.to)?.label+'</h3><p>'+new Date(item.at).toLocaleString('ru-RU')+(item.system?' · автоматически':'')+'</p></div>').join('')+'</div>':'');
  openDrawer('ЗАДАЧА / '+task.code,task.title,body);
}
function eligibleTaskEditors(task){return users.filter(user=>user.status==='active'&&user.role!=='admin'&&user.id!==task.createdBy&&user.projects?.includes(task.project)&&accessCan('planning',task.project,'read',user));}
function renderTaskSharePicker(){
  const task=tasks.find(item=>item.id===sharingTaskId);if(!task)return;
  const eligible=eligibleTaskEditors(task),query=$('taskShareSearch').value.trim().toLocaleLowerCase('ru'),selected=new Set(selectedShareEditorIds);
  $('taskShareChips').innerHTML=selectedShareEditorIds.map(id=>{const user=users.find(item=>item.id===id);return '<span class="task-chip">'+escapeHtml(user?.name??'Пользователь удалён')+'<button type="button" data-remove-share-user="'+escapeHtml(id)+'" aria-label="Отозвать право у '+escapeHtml(user?.name??'пользователя')+'">×</button></span>';}).join('')||'<span class="muted">Права ещё никому не переданы</span>';
  const matches=eligible.filter(user=>!selected.has(user.id)&&(user.name+' '+user.email+' '+(user.position??'')).toLocaleLowerCase('ru').includes(query)).slice(0,12);
  $('taskShareResults').innerHTML=matches.map(user=>'<button class="task-share-result" type="button" role="option" data-add-share-user="'+escapeHtml(user.id)+'"><strong>'+escapeHtml(user.name)+'</strong><small>'+escapeHtml(user.email)+' · '+escapeHtml(user.position??accessRoleLabel(user))+'</small></button>').join('')||'<div class="task-share-empty">'+(query?'Совпадений не найдено':'Нет других активных пользователей с доступом к проекту')+'</div>';
}
function openTaskShare(id){
  const task=tasks.find(item=>item.id===id);if(!task||!accessCanShareTask(task)){notify('Передать права может только создатель задачи.');return;}
  sharingTaskId=id;selectedShareEditorIds=[...(task.editorIds??[])];$('taskShareSearch').value='';$('taskShareTitle').textContent='Поделиться правами · '+task.title;$('taskShareError').hidden=true;renderTaskSharePicker();$('taskShareDialog').showModal();$('taskShareSearch').focus();
}
async function saveTaskShare(event){
  event.preventDefault();const task=tasks.find(item=>item.id===sharingTaskId);if(!task||!accessCanShareTask(task)){notify('Передать права может только создатель задачи.');return;}
  const button=$('taskShareSave');button.disabled=true;$('taskShareError').hidden=true;
  try{
    if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate({operation:'share',id:task.id,editorIds:selectedShareEditorIds});applyPlanningState(result.planning);}
    else task.editorIds=[...selectedShareEditorIds];
    persist();$('taskShareDialog').close();render();if(selectedTask===task.id&&$('detailDrawer').classList.contains('open'))openTask(task.id);notify('Права доступа к задаче обновлены.');
  }catch(error){$('taskShareError').textContent=error.message;$('taskShareError').hidden=false;}
  finally{button.disabled=false;}
}
async function deleteTask(id){
  const task=tasks.find(item=>item.id===id);if(!task||!accessCanManageTask(task)){notify('Удалить задачу может только создатель или пользователь с переданным правом.');return;}
  if(tasks.some(item=>item.parentId===id)){notify('Сначала удалите или перепривяжите дочерние задачи.');return;}
  if(!window.confirm('Удалить задачу «'+task.title+'»? Это действие нельзя отменить.'))return;
  try{
    if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate({operation:'delete',id});applyPlanningState(result.planning);}
    else{tasks=tasks.filter(item=>item.id!==id);taskEvents=taskEvents.filter(item=>item.taskId!==id);}
    closeDrawer();persist();render();notify('Задача удалена.');
  }catch(error){notify(error.message);}
}
function openPurchase(id) {
  const purchase=purchases.find(item=>item.id===id);if(!purchase)return;
  if(!accessRequire('purchases',purchase.project))return;
  selectedTask=null;const details=purchaseDetails[id];
  const trace=details?.trace??[['Проект',planningProjects[purchase.project].code],['Потребность',purchase.id+' / '+purchase.iteration],['Компонент',purchase.component],['Приёмка',purchase.accepted+' из '+purchase.quantity+' единиц'],['Брак',purchase.defect+' единиц'],['Сумма',money(purchase.amount)],['Документы',purchase.links.join(' · ')]];
  openDrawer('ЦЕПОЧКА ЗАКУПКИ',purchase.id+' · '+purchase.component,badge(purchase.status,purchase.kind)+detailRows(trace)+'<div class="drawer-note">'+escapeHtml(details?.note??(purchase.defect?'Отклонение отражено в реестре качества; решение связано с бюджетной корректировкой.':'Закупка связана с пакетом работ и реестром приёмки.'))+'</div>');
}
function openUserForm(id=null) {
  openAccessUserForm(id);
}
function saveUser(event) {
  saveAccessUser(event);
}

function snapshot() {
  if(!accessActive()||accessActor().role!=='leader')throw new Error('Полный снимок доступен только руководителю.');
  return { system:'ЭПСИЛОН', currency:'RUB', financialUnit:'тыс. руб.', componentPriceUnit:'руб.', requestCostUnit:'руб.', capturedAt:new Date().toISOString(), scope, scopeName:scopeName(), period, totals:totals(), projects:scopeIds().map(id=>({id,...planningProjects[id],financial:financial(id)})), tasks:tasks.filter(inScope).map(task=>({...structuredClone(task),owner:taskOwner(task)})), purchases:structuredClone(purchases.filter(inScope)), changes:structuredClone(changes.filter(inScope)), scores:healthScores(), technology:structuredClone({components:techComponents.filter(inScope),requests:techRequests.filter(inScope),events:techEvents.filter(inScope)}), production:productionSnapshot() };
}
function reportSnapshot(data) {
  const report=normalizeRubDemoData(structuredClone(data));
  Object.assign(report,{currency:'RUB',financialUnit:'тыс. руб.',componentPriceUnit:'тыс. руб.',requestCostUnit:'тыс. руб.',moneyScale:1000});
  const convertComponent=c=>{
    if(!c)return;
    c.quotedCurrency=c.currency;
    c.unitPrice=c.unitPrice*(techRates[c.currency]??1)/1000;
    c.currency='RUB';
  };
  if(report.technology){
    report.technology.components.forEach(convertComponent);
    report.technology.requests.forEach(r=>{
      r.cost/=1000;
      if(r.type==='purchase'){
        r.quotedCurrency=r.currency;
        r.unitPrice=r.unitPrice*r.rate/1000;
        r.currencyAmount=r.cost;
        r.currency='RUB';
        r.rateUnit='руб. за 1 '+r.quotedCurrency;
      }
    });
    report.technology.events.forEach(e=>{convertComponent(e.before);convertComponent(e.after);});
  }
  return report;
}
function csvCell(value) { if(typeof value==='number'&&Number.isFinite(value))return '"'+value.toLocaleString('ru-RU',{useGrouping:false,maximumFractionDigits:6})+'"';let text=String(value??'');if(/^[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'; }
function downloadReport(data,format,name) {
  if(!accessActive()||accessActor().role!=='leader'){notify('Нет права на выгрузку полного отчёта.');return;}
  if(data.reportKind==='production'&&data.production){downloadProductionReport(data,format,name);return;}
  let body,type,extension;
  data=normalizeRubDemoData(data);
  const tech=data.technology??{components:[],requests:[],events:[]};
  if(format==='json'){body=JSON.stringify(reportSnapshot(data),null,2);type='application/json;charset=utf-8';extension='json';}
  else if(format==='excel'){
    const rows=[['ЭПСИЛОН',data.scopeName,data.period],['Финансовые показатели','тыс. руб.'],['План',data.totals.base],['Факт',data.totals.actual],['Обязательства',data.totals.commitments],['EAC',data.totals.eac],[],['КАРТОЧКИ'],['Код','Проект','Название','Статус','Ответственный','Срок','План, тыс. руб.','Факт, тыс. руб.','Обязательства, тыс. руб.','EAC, тыс. руб.','Бюджетная заявка'],...data.tasks.map(task=>[task.code,planningProjects[task.project].code,task.title,stages.find(stage=>stage.id===task.stage).label,task.owner,task.due,task.plan,task.actual,task.commitments,task.eac,task.proposed?'Да':'Нет']),[],['ЗАКУПКИ'],['Код','Проект','Компонент','Сумма, тыс. руб.','Принято','Брак','Полный пакет'],...data.purchases.map(item=>[item.id,planningProjects[item.project].code,item.component,item.amount,item.accepted,item.defect,item.complete?'Да':'Нет']),[],['КОРРЕКТИРОВКИ'],['Код','Проект','Причина','Влияние, тыс. руб.','Статус'],...data.changes.map(item=>[item.id,planningProjects[item.project].code,item.title,item.amount,item.status])];
    rows.push([],['ТЕХНОЛОГИЧЕСКАЯ КАРТА'],['Проект','Подсистема','Код','Компонент','Ревизия','На изделие','Потребность партии','Годных актуальной ревизии','Склад всего годных','Ревизия остатка','В пути актуальной ревизии','Ревизия заказа','Брак','Верификация','Основание'],...tech.components.map(c=>[planningProjects[c.project].code,c.group,c.code,c.name,c.revision,c.perUnit,c.perUnit*techProducts[c.project].batch,usableStock(c),c.stock,c.stockRevision,usableOrder(c),c.orderRevision,c.defect,techVerificationLabels[c.verification],c.document]),[],['ЗАПРОСЫ КОМПОНЕНТОВ'],['Код','Проект','Компонент','Ревизия','Тип','Статус','Обоснование','Оценка, тыс. руб.','Срок','Основание'],...tech.requests.map(r=>[r.code,planningProjects[r.project].code,r.componentName,r.revision,r.type,requestLabel(r),r.reason,r.cost/1000,r.due,r.document]),[],['ИСТОРИЯ СОСТАВА'],['Дата','Изменение','Обоснование','Документ'],...tech.events.map(e=>[e.at,e.title,e.reason,e.document]));
    rows.push(...productionReportRows(data.production));
    body='\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');type='text/csv;charset=utf-8';extension='csv';
  }else{
    const table='<table><tr><th>Пакет работ</th><th>Проект</th><th>Статус</th><th>Ответственный</th><th>Срок</th><th>План / EAC, тыс. руб.</th></tr>'+data.tasks.map(task=>'<tr><td>'+escapeHtml(task.title)+'</td><td>'+planningProjects[task.project].code+'</td><td>'+stages.find(stage=>stage.id===task.stage).label+'</td><td>'+escapeHtml(task.owner)+'</td><td>'+displayDate(task.due)+'</td><td>'+reportMoney(task.plan)+' / '+reportMoney(task.eac)+'</td></tr>').join('')+'</table>';
    const techTable='<h2>Технологическая карта</h2><table><tr><th>Компонент</th><th>Ревизия</th><th>Годных актуальной ревизии / потребность</th><th>Брак</th><th>Верификация</th><th>Основание</th></tr>'+tech.components.map(c=>'<tr><td>'+escapeHtml(planningProjects[c.project].code+' · '+c.code+' · '+c.name)+'</td><td>'+escapeHtml(c.revision)+'</td><td>'+usableStock(c)+' / '+c.perUnit*techProducts[c.project].batch+'</td><td>'+c.defect+'</td><td>'+techVerificationLabels[c.verification]+'</td><td>'+escapeHtml(c.document)+'</td></tr>').join('')+'</table><h2>Обоснования изменений</h2>'+tech.events.map(e=>'<p><strong>'+escapeHtml(e.title)+'</strong><br>'+escapeHtml(e.reason)+'<br>Основание: '+escapeHtml(e.document)+'</p>').join('')+'<h2>Запросы компонентов</h2>'+tech.requests.map(r=>'<p><strong>'+escapeHtml(r.code+' · '+r.componentName+' · '+r.revision)+'</strong><br>'+requestLabel(r)+' · оценка '+reportMoney(r.cost/1000)+'<br>'+escapeHtml(r.reason)+'</p>').join('');
    body='\ufeff<html><head><meta charset="utf-8"><title>ЭПСИЛОН</title><style>body{font-family:Arial;color:#14242f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;font-size:11px}th{background:#e8f4f2;text-align:left}h1{font-size:28px}h2{font-size:18px}</style></head><body><h1>ЭПСИЛОН · Обзор проекта</h1><p>'+escapeHtml(data.scopeName)+' · '+data.period.toUpperCase()+'</p><p>Снимок: '+new Date(data.capturedAt).toLocaleString('ru-RU')+'</p><h2>Финансовые показатели, тыс. руб.</h2><p>План: '+reportMoney(data.totals.base)+'<br>Факт: '+reportMoney(data.totals.actual)+'<br>Обязательства: '+reportMoney(data.totals.commitments)+'<br>EAC: '+reportMoney(data.totals.eac)+'</p><h2>Пакеты работ</h2>'+table+'<h2>Профиль проекта</h2><p>'+data.scores.map(item=>item.label+': '+item.value+'%').join(' · ')+'</p>'+techTable+'<p>Демонстрационные данные.</p></body></html>';type='application/msword;charset=utf-8';extension='doc';
  }
  if(format==='word')body=body.replace('</body>',productionReportHtml(data.production)+'</body>');
  const url=URL.createObjectURL(new Blob([body],{type})),link=document.createElement('a');link.href=url;link.download=name+'.'+extension;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportReport(format) {
  if(!accessActive()||accessActor().role!=='leader'){notify('Экспорт доступен только руководителю.');return;}
  const data=snapshot(),id='RPT-'+String(reportHistory.length+1).padStart(3,'0'),name='EPSILON-'+(scope==='all'?'portfolio':planningProjects[scope].code)+'-'+period+'-'+Date.now();
  downloadReport(data,format,name);reportHistory.unshift({id,name,format,snapshot:data,createdAt:data.capturedAt});reportHistory=reportHistory.slice(0,25);persist();renderReports();notify('Отчёт сформирован и сохранён в истории.');
}
function openReportDialog() { if(!accessActive()||accessActor().role!=='leader'){notify('Нет права выгрузки отчёта.');return;}$('reportContext').textContent=scopeName()+' · '+period.toUpperCase()+' · '+tasks.filter(inScope).length+' пакетов работ';$('reportDialog').showModal(); }
function renderProjectTagRows(project){
  $('projectTagRows').innerHTML=projectTagList(project).map(tag=>'<label class="project-tag-row"><span class="task-tag"><i style="--tag-color:'+escapeHtml(tag.color)+'"></i>'+escapeHtml(tag.name)+'</span><small>'+escapeHtml(tag.kind==='department'?'Автотег отдела':tag.kind==='user'?'Пользователь':'Метка проекта')+'</small><input type="color" value="'+escapeHtml(tag.color)+'" data-tag-color="'+escapeHtml(tag.id)+'" data-tag-project="'+escapeHtml(project)+'" aria-label="Цвет метки '+escapeHtml(tag.name)+'"'+(tag.kind==='department'?' disabled':'')+' /></label>').join('')||empty('Метки проекта ещё не настроены.');
}
function openTaskTags(){
  const allowed=accessScopeProjects().filter(p=>accessCan('planning',p,'write'));if(!allowed.length){notify('Нет права настраивать метки.');return;}
  $('tagProjectSelect').innerHTML=allowed.map(p=>'<option value="'+p+'">'+escapeHtml(planningProjects[p].code+' · '+planningProjects[p].name)+'</option>').join('');
  $('tagProjectSelect').value=allowed.includes(scope)?scope:allowed[0];renderProjectTagRows($('tagProjectSelect').value);$('taskTagsError').hidden=true;$('taskTagsDialog').showModal();
}
async function updateProjectTag(project,tagId,color){
  try{
    let planning;
    if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate({operation:'tag-color',project,tagId,color});planning=result.planning;}
    else{const tag=projectTagList(project).find(t=>t.id===tagId);if(tag)tag.color=color;planning={tasks,taskEvents,projectTags};}
    applyPlanningState(planning);renderProjectTagRows(project);if($('taskDialog').open&&$('taskForm').elements.project.value===project)renderTaskTags(project,[...$('taskForm').querySelectorAll('[name="taskTags"]:checked')].map(x=>x.value));
  }catch(error){$('taskTagsError').textContent=error.message;$('taskTagsError').hidden=false;}
}
async function createProjectTag(event){
  event.preventDefault();const form=event.target;if(!form.reportValidity())return;const project=$('tagProjectSelect').value,name=form.elements.name.value.trim(),color=form.elements.color.value;
  try{
    let planning;if(globalThis.epsilonPlanning){const result=await globalThis.epsilonPlanning.mutate({operation:'tag-create',project,name,color});planning=result.planning;}
    else{projectTagList(project).push({id:uid('tag'),kind:'custom',name,color});planning={tasks,taskEvents,projectTags};}
    applyPlanningState(planning);form.reset();form.elements.color.value='#63a7ff';renderProjectTagRows(project);notify('Метка добавлена в список этого проекта.');
  }catch(error){$('taskTagsError').textContent=error.message;$('taskTagsError').hidden=false;}
}
async function pollTaskNotifications(){
  try{
    let items=[];
    if(globalThis.epsilonPlanning)items=(await globalThis.epsilonPlanning.notifications()).items??[];
    else{
      const now=Date.now();for(const task of tasks){if(task.taskType==='recurring'&&task.stage==='backlog'&&Date.parse(task.due+'T09:00:00Z')-Number(task.activateDaysBefore??3)*86400000<=now){task.stage='work';taskEvents.push({taskId:task.id,from:'backlog',to:'work',at:new Date(now).toISOString(),system:true});}
        for(const at of task.reminders??[]){if(Date.parse(at)>now)continue;const key=task.id+'|'+at+'|'+(task.ownerId??task.createdBy);if(taskReminderLog.includes(key))continue;taskReminderLog.push(key);items.push({taskId:task.id,title:task.title,project:task.project,due:task.due,at});}
      }taskReminderLog=taskReminderLog.slice(-1000);persist();
    }
    for(const item of items){const message='Напоминание: '+item.title+' · срок '+displayDate(item.due);if('Notification'in window&&Notification.permission==='granted'){const note=new Notification('ЭПСИЛОН · задача',{body:message,tag:'epsilon-task-'+item.taskId});note.onclick=()=>{window.focus();selectProject(item.project);navigate('planning');note.close();};}else notify(message);}
  }
  catch{/* Notification polling must not interrupt the board. */}
}

document.addEventListener('click',event=>{
  const route=event.target.closest('[data-route]');if(route&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();navigate(route.dataset.route);return;}
  const close=event.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
  const deadline=event.target.closest('[data-save-deadline]');if(deadline){saveTaskDeadline(deadline.dataset.saveDeadline);return;}
  const project=event.target.closest('[data-project]');if(project){selectProject(project.dataset.project);return;}
  const add=event.target.closest('[data-add-task]');if(add){openTaskForm();return;}
  const edit=event.target.closest('[data-edit-task]');if(edit){openTaskForm(edit.dataset.editTask);return;}
  const share=event.target.closest('[data-share-task]');if(share){openTaskShare(share.dataset.shareTask);return;}
  const remove=event.target.closest('[data-delete-task]');if(remove){deleteTask(remove.dataset.deleteTask);return;}
  const task=event.target.closest('[data-task]');if(task&&!dragId){openTask(task.dataset.task);return;}
  const purchase=event.target.closest('[data-purchase]');if(purchase){openPurchase(purchase.dataset.purchase);return;}
  const user=event.target.closest('[data-user]');if(user){openUserForm(user.dataset.user);return;}
  const report=event.target.closest('[data-report]');if(report){const item=reportHistory.find(item=>item.id===report.dataset.report);if(item)downloadReport(item.snapshot,item.format,item.name);return;}
  const exp=event.target.closest('[data-export]');if(exp)exportReport(exp.dataset.export);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeDrawer();
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-task]:not(button),[data-purchase]')){event.preventDefault();event.target.click();}
});
$('projectSelect').addEventListener('change',event=>selectProject(event.target.value));
$('periodSelect').addEventListener('change',event=>{period=event.target.value;persist();render();navigate(currentRoute,{replace:true});});
$('taskSearch').addEventListener('input',renderPlanning);$('userSearch').addEventListener('input',renderUsers);$('purchaseFilter').addEventListener('change',renderPurchases);
$('addTask').addEventListener('click',()=>openTaskForm());$('taskForm').addEventListener('submit',saveTask);$('taskForm').elements.project.addEventListener('change',event=>{fillOwners(event.target.value);fillTaskParents(event.target.value,$('taskForm').elements.kind.value);renderTaskTags(event.target.value);});
$('taskShareForm').addEventListener('submit',saveTaskShare);$('taskShareSearch').addEventListener('input',renderTaskSharePicker);$('taskShareResults').addEventListener('click',event=>{const option=event.target.closest('[data-add-share-user]');if(!option)return;const id=option.dataset.addShareUser;if(!selectedShareEditorIds.includes(id))selectedShareEditorIds.push(id);renderTaskSharePicker();$('taskShareSearch').focus();});$('taskShareChips').addEventListener('click',event=>{const remove=event.target.closest('[data-remove-share-user]');if(!remove)return;selectedShareEditorIds=selectedShareEditorIds.filter(id=>id!==remove.dataset.removeShareUser);renderTaskSharePicker();});
$('taskForm').elements.kind.addEventListener('change',event=>fillTaskParents($('taskForm').elements.project.value,event.target.value));$('taskForm').elements.ownerId.addEventListener('change',renderCoExecutorChips);
$('taskForm').elements.taskType.addEventListener('change',event=>document.querySelectorAll('.recurring-option').forEach(el=>el.hidden=event.target.value!=='recurring'));
$('addCoExecutor').addEventListener('click',()=>{const id=$('coExecutorSelect').value;if(id&&!selectedCoExecutorIds.includes(id)&&id!==$('taskForm').elements.ownerId.value)selectedCoExecutorIds.push(id);renderCoExecutorChips();$('coExecutorSelect').value='';});
$('coExecutorChips').addEventListener('click',event=>{const remove=event.target.closest('[data-remove-coexecutor]');if(remove){selectedCoExecutorIds=selectedCoExecutorIds.filter(id=>id!==remove.dataset.removeCoexecutor);renderCoExecutorChips();}});
$('addTaskReminder').addEventListener('click',()=>{const row=document.createElement('div');row.className='task-reminder-row';row.innerHTML='<input name="reminders" type="datetime-local" aria-label="Время напоминания" /><button class="icon-button remove-reminder" type="button" aria-label="Удалить напоминание">×</button>';$('taskReminderRows').append(row);row.querySelector('input').focus();});
$('taskReminderRows').addEventListener('click',event=>{const remove=event.target.closest('.remove-reminder');if(!remove)return;const rows=$('taskReminderRows').querySelectorAll('.task-reminder-row');if(rows.length===1)rows[0].querySelector('input').value='';else remove.closest('.task-reminder-row').remove();});
$('manageTaskTags').addEventListener('click',openTaskTags);$('tagProjectSelect').addEventListener('change',event=>renderProjectTagRows(event.target.value));$('newProjectTagForm').addEventListener('submit',createProjectTag);
$('projectTagRows').addEventListener('change',event=>{const input=event.target.closest('[data-tag-color]');if(input)updateProjectTag(input.dataset.tagProject,input.dataset.tagColor,input.value);});
$('enableTaskNotifications').addEventListener('click',async()=>{if(!('Notification'in window)){notify('Браузер не поддерживает системные уведомления.');return;}try{const permission=await Notification.requestPermission();notify(permission==='granted'?'Уведомления включены в этом браузере.':'Разрешение на уведомления не выдано.');}catch{notify('Не удалось включить системные уведомления.');}});
pollTaskNotifications();window.setInterval(pollTaskNotifications,60000);
$('addUser').addEventListener('click',()=>openUserForm());$('userForm').addEventListener('submit',saveUser);
setupProduction();
setupAccess();
$('currentUserButton').addEventListener('click',()=>openUserForm(accessActor()?.id));
$('closeDrawer').addEventListener('click',closeDrawer);$('drawerBody').addEventListener('change',event=>{if(event.target.id==='taskStage')moveTask(selectedTask,event.target.value);});
for(const id of ['dashboardExport','budgetExport','reportExport'])$(id).addEventListener('click',openReportDialog);
$('reportForm').addEventListener('submit',event=>{event.preventDefault();exportReport($('reportForm').elements.format.value);$('reportDialog').close();});
const board=$('kanbanBoard');
board.addEventListener('dragstart',event=>{const card=event.target.closest('[data-task]');if(!card)return;dragId=card.dataset.task;event.dataTransfer.setData('text/plain',dragId);event.dataTransfer.effectAllowed='move';card.classList.add('dragging');});
board.addEventListener('dragover',event=>{const target=event.target.closest('[data-drop-stage]');if(!target||!dragId)return;event.preventDefault();event.dataTransfer.dropEffect='move';document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));target.classList.add('drop-active');});
board.addEventListener('dragleave',event=>{const target=event.target.closest('[data-drop-stage]');if(target&&!target.contains(event.relatedTarget))target.classList.remove('drop-active');});
board.addEventListener('drop',event=>{const target=event.target.closest('[data-drop-stage]');if(!target||!dragId)return;event.preventDefault();const id=dragId;dragId=null;moveTask(id,target.dataset.dropStage);});
board.addEventListener('dragend',()=>{document.querySelectorAll('.dragging,.drop-active').forEach(el=>el.classList.remove('dragging','drop-active'));setTimeout(()=>{dragId=null;},0);});
window.addEventListener('popstate',()=>{const route=parseUrl();render();navigate(route,{history:false});});
window.addEventListener('hashchange',()=>{if(location.protocol==='file:'){const route=parseUrl();render();navigate(route,{history:false});}});
const initialRoute=parseUrl();navigate(initialRoute,{replace:true});

if(document.modelContext?.registerTool) {
  const register=tool=>Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});
  register({name:'get_workspace_snapshot',title:'Получить разрешённый снимок ЭПСИЛОН',description:'Данные в пределах демонстрируемой роли, без переписок.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>accessSafeSnapshot()});
  register({name:'set_workspace_project',title:'Выбрать проект',description:'Изменить контекст в пределах допуска.',inputSchema:{type:'object',properties:{project:{type:'string',enum:['all',...projectIds]}},required:['project'],additionalProperties:false},execute:input=>{if(input.project!=='all'&&!accessScopeProjects().includes(input.project))throw new Error('Нет допуска к проекту');selectProject(input.project);return accessSafeSnapshot();}});
}
