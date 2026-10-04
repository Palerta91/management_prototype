'use strict';

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const uid = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const storageKey = 'epsilon.workspace.v1';
const projectIds = Object.keys(planningProjects);
const roles = { admin:'Администратор', manager:'Руководитель проекта', engineer:'Инженер', procurement:'Закупки', investor:'Инвестор · просмотр' };
const routes = { dashboard:'Дашборд', planning:'Планирование', technology:'Технологическая карта', purchases:'Закупки', budget:'Бюджет', quality:'Качество и брак', changes:'Корректировки', reports:'Отчёты', users:'Пользователи' };
const stages = [
  { id:'backlog', label:'Бэклог', color:'#718493' },
  { id:'approval', label:'К утверждению', color:'#a999ff' },
  { id:'work', label:'В работе', color:'#63a7ff' },
  { id:'verification', label:'На верификации', color:'#55e6d2' },
  { id:'decision', label:'Требует решения', color:'#f4ba4b' },
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

function loadState() { try { const data = JSON.parse(localStorage.getItem(storageKey)); return data && typeof data === 'object' ? data : {}; } catch { return {}; } }
const saved = loadState();
function validTask(task) { return task && /^[\w-]+$/.test(task.id) && projectIds.includes(task.project) && stages.some(stage => stage.id === task.stage) && typeof task.title === 'string' && task.title.length <= 140 && /^\d{4}-\d{2}-\d{2}$/.test(task.due) && ['plan','actual','commitments','eac'].every(key => Number.isFinite(task[key]) && task[key] >= 0 && task[key] <= 100000); }
function validUser(user) { return user && /^[\w-]+$/.test(user.id) && typeof user.name === 'string' && typeof user.email === 'string' && user.role in roles && ['active','inactive'].includes(user.status) && Array.isArray(user.projects) && user.projects.every(id => projectIds.includes(id)); }
let tasks = Array.isArray(saved.tasks) && saved.tasks.length && saved.tasks.every(validTask) ? saved.tasks : structuredClone(planningCards);
initialBacklog.forEach(task=>{if(!tasks.some(item=>item.id===task.id))tasks.push(structuredClone(task));});
let users = Array.isArray(saved.users) && saved.users.length && saved.users.every(validUser) ? saved.users : structuredClone(defaultUsers);
let reportHistory = Array.isArray(saved.reports) ? saved.reports.filter(item => item && typeof item.id === 'string' && item.snapshot).slice(0, 25) : [];
let taskEvents = Array.isArray(saved.taskEvents) ? saved.taskEvents.filter(item => item && typeof item.taskId === 'string').slice(-100) : [];
let scope = projectIds.includes(saved.scope) ? saved.scope : 'all';
let period = saved.period === 'q4' ? 'q4' : 'q3';
let currentRoute = 'dashboard';
let editingTask = null;
let editingUser = null;
let selectedTask = null;
let dragId = null;
let toastTimer;
let drawerReturnFocus;
initializeTechnology(saved);

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ tasks, users, reports:reportHistory, taskEvents, scope, period, technology:technologyState() })); return true; }
  catch { notify('Не удалось сохранить изменения в браузере. Экспортируйте снимок данных.'); return false; }
}
function notify(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200); }
function money(value) { const n = Math.abs(value); return '€ ' + (n >= 1000 ? (n / 1000).toFixed(2) + 'M' : n.toLocaleString('ru-RU', { maximumFractionDigits:1 }) + 'K').replace('.', ','); }
function delta(value) { return (value < 0 ? '−' : '+') + money(value); }
function number(value) { return Number(value).toLocaleString('ru-RU', { maximumFractionDigits:1 }); }
function displayDate(value) { if (!value) return '—'; const [year, month, day] = value.slice(0,10).split('-'); return day + '.' + month + '.' + year; }
function isoDate(value) { const parts = value.split('.'); return parts.length === 3 ? parts.reverse().join('-') : value; }
function initials(value) { return value.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function scopeIds() { return scope === 'all' ? projectIds : [scope]; }
function inScope(item) { return scopeIds().includes(item.project); }
function scopeName() { return scope === 'all' ? 'Весь портфель' : planningProjects[scope].code + ' · ' + planningProjects[scope].name; }
function taskOwner(task) { return users.find(user => user.id === task.ownerId)?.name ?? task.owner?.split(' · ')[0] ?? 'Не назначен'; }
function financial(id) { const project = planningProjects[id]; const forecast = period === 'q4' ? profiles[id].q4 : project; return { base:project.base, actual:forecast.actual, commitments:forecast.commitments, eac:forecast.eac }; }
function totals() { return scopeIds().reduce((sum,id) => { const values = financial(id); Object.keys(sum).forEach(key => sum[key] += values[key]); return sum; }, { base:0, actual:0, commitments:0, eac:0 }); }
function metric(label,value,note='',tone='') { return '<article class="metric"><span class="metric-label">' + escapeHtml(label) + '</span><strong class="metric-value ' + tone + '">' + escapeHtml(value) + '</strong><span class="metric-note">' + escapeHtml(note) + '</span></article>'; }
function financeMetrics() { const t = totals(); return [metric('Базовый план', money(t.base), 'Утверждённая версия B2'), metric('Факт', money(t.actual), number(t.actual/t.base*100) + '% освоения'), metric('Обязательства', money(t.commitments), 'Открытые заказы'), metric('Прогноз EAC', money(t.eac), 'Оценка до завершения','accent'), metric('Отклонение',delta(t.eac-t.base),number((t.eac/t.base-1)*100)+'% к базовому плану',t.eac>t.base?'negative':'positive')].join(''); }
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
    { label:'Бюджет', value:Math.min(100, Math.round(t.base/t.eac*100)), detail:'Базовый план / EAC' },
    { label:'Сроки', value:cards.length ? Math.round(onTime/cards.length*100) : 0, detail:'Пакеты без сдвига прогнозного срока' },
    { label:'Качество', value:Math.round(sum.accepted/sum.qualityTotal*100), detail:'Принятые комплектующие / проверенные' },
    { label:'Закупки', value:Math.round(sum.readyOrders/sum.orders*100), detail:'Полные закупочные пакеты / все заказы' },
    { label:'Испытания', value:Math.round(sum.passed/sum.tests*100), detail:'Пройденные испытания / программа' },
    { label:'Документы', value:Math.round(sum.complete/sum.docs*100), detail:'Готовые документы / требуемые' }
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
  $('projectCards').innerHTML=scopeIds().map(id=>{const project=planningProjects[id],f=financial(id),progress=Math.round(f.actual/f.eac*100);return '<button class="project-row" data-project="'+id+'" type="button"><div class="project-row-top"><span class="project-name">'+project.name+'<span>'+project.code+'</span></span><span class="project-finance">'+money(f.base)+' / <span class="'+(f.eac>f.base?'negative':'positive')+'">'+money(f.eac)+'</span></span></div><div class="budget-track"><span style="width:'+progress+'%;background:var(--accent)"></span><span style="width:'+(f.commitments/f.eac*100)+'%;background:var(--blue)"></span></div><div class="project-row-meta"><span>Освоено '+progress+'% · '+tasks.filter(task=>task.project===id).length+' пакетов</span><span>До '+project.finish+' ↗</span></div></button>';}).join('');
  const attention=cards.filter(task=>task.stage==='decision'||task.health==='risk'&&task.stage!=='closed').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  $('attentionCount').textContent=attention.length+' ПАКЕТОВ';
  $('attentionList').innerHTML=attention.length?attention.map(task=>'<div class="list-row clickable" data-task="'+escapeHtml(task.id)+'" tabindex="0" role="button"><div class="list-row-top"><h3>'+escapeHtml(task.title)+'</h3>'+badge(task.stage==='decision'?'РЕШЕНИЕ':'РИСК','warning')+'</div><p>'+escapeHtml(task.reason)+'</p><span class="unit">'+planningProjects[task.project].code+' · '+displayDate(task.due)+' · EAC '+money(task.eac)+'</span></div>').join(''):empty('Открытых рисков и решений нет');
}
function taskCard(task) {
  const color=task.stage==='closed'?'#4ddc8b':task.health==='risk'?'#f47b7b':task.proposed?'#a999ff':'#63a7ff';
  return '<button class="kanban-card" draggable="true" data-task="'+escapeHtml(task.id)+'" style="--card-color:'+color+'" type="button" aria-label="Открыть '+escapeHtml(task.title)+'"><span class="card-project">'+planningProjects[task.project].code+' · '+escapeHtml(task.code)+'<span class="grip" aria-hidden="true">⠿</span></span><h3>'+escapeHtml(task.title)+'</h3><div class="card-budget"><span><small>План</small><strong>'+money(task.plan)+'</strong></span><span><small>EAC</small><strong class="accent">'+money(task.eac)+'</strong></span><span><small>Факт</small><strong>'+money(task.actual)+'</strong></span><span><small>Обязательства</small><strong>'+money(task.commitments)+'</strong></span></div><span class="card-owner"><span>'+escapeHtml(taskOwner(task))+'</span><time datetime="'+task.due+'">'+displayDate(task.due).slice(0,5)+'</time></span>'+(task.proposed?'<span class="card-proposal">Бюджетная заявка</span>':'')+'</button>';
}
function renderPlanning() {
  const query=$('taskSearch').value.trim().toLocaleLowerCase('ru');
  const all=tasks.filter(inScope),cards=all.filter(task=>(task.title+' '+task.code+' '+taskOwner(task)+' '+planningProjects[task.project].code).toLocaleLowerCase('ru').includes(query));
  const t=totals(),proposed=all.filter(task=>task.proposed&&!task.superseded).reduce((sum,task)=>sum+task.plan,0);
  $('boardScope').textContent=scopeName(); $('boardCount').textContent=cards.length+'/'+all.length+' пакетов';
  $('boardStats').innerHTML='<span>Базовый бюджет<strong>'+money(t.base)+'</strong></span><span>Факт + обязательства<strong>'+money(t.actual+t.commitments)+'</strong></span><span>Прогноз EAC<strong class="accent">'+money(t.eac)+'</strong></span><span>Новые заявки<strong>'+money(proposed)+'</strong></span>';
  $('kanbanBoard').innerHTML=stages.map(stage=>{const items=cards.filter(task=>task.stage===stage.id);return '<section class="kanban-column" aria-label="'+stage.label+'"><div class="kanban-column-head" style="--stage-color:'+stage.color+'"><h2>'+stage.label+'</h2><span>'+String(items.length).padStart(2,'0')+'</span></div><div class="kanban-cards" data-drop-stage="'+stage.id+'">'+items.map(taskCard).join('')+(stage.id==='backlog'?'<button class="backlog-add" data-add-task type="button">+ Добавить карточку</button>':'')+(!items.length&&stage.id!=='backlog'?empty('Карточек пока нет'):'')+'</div></section>';}).join('');
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
  const rows=growthSources(),max=totals().eac;
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
  const members=users.filter(user=>scope==='all'||user.projects.includes(scope));
  const query=$('userSearch').value.trim().toLocaleLowerCase('ru');
  const visible=members.filter(user=>(user.name+' '+user.email+' '+roles[user.role]).toLocaleLowerCase('ru').includes(query));
  $('userSummary').innerHTML='<div>Участников<strong>'+members.length+'</strong>В выбранных проектах</div><div>Активных<strong>'+members.filter(user=>user.status==='active').length+'</strong>Назначаются на карточки</div><div>Ролей<strong>'+new Set(members.map(user=>user.role)).size+'</strong>В команде</div>';
  $('userRows').innerHTML=visible.length?visible.map(user=>'<tr><td><div class="user-cell"><span class="user-avatar">'+escapeHtml(initials(user.name))+'</span><div><strong>'+escapeHtml(user.name)+'</strong><small>'+escapeHtml(user.email)+'</small></div></div></td><td>'+roles[user.role]+'</td><td><div class="user-projects">'+user.projects.map(id=>'<span>'+planningProjects[id].code+'</span>').join('')+'</div></td><td>'+badge(user.status==='active'?'Активен':'Неактивен',user.status==='active'?'good':'warning')+'</td><td><button class="btn small" data-user="'+escapeHtml(user.id)+'" type="button">Настроить</button></td></tr>').join(''):'<tr><td colspan="5">'+empty('Пользователи не найдены')+'</td></tr>';
  $('currentUserInitials').textContent=initials(users.find(user=>user.id==='admin')?.name??'Администратор');
}
function renderReports() {
  const visible=reportHistory.filter(report=>scope==='all'||report.snapshot.projects.some(project=>project.id===scope));
  $('reportHistory').innerHTML=visible.length?visible.map(report=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(report.id+' · '+report.name)+'</h3><button class="btn small" data-report="'+escapeHtml(report.id)+'" type="button">↓ Скачать снова</button></div><p>'+escapeHtml(report.snapshot.scopeName)+' · '+new Date(report.createdAt).toLocaleString('ru-RU')+' · '+report.snapshot.period.toUpperCase()+'</p></div>').join(''):empty('Отчётов пока нет. Сформируйте первый снимок выбранного проекта.');
}

function render() {
  $('projectSelect').value=scope; $('periodSelect').value=period;
  $('sidebarScope').textContent=scope==='all'?'Весь портфель':planningProjects[scope].code;
  $('sidebarScopeNote').textContent=scope==='all'?'3 проекта · единый контроль':planningProjects[scope].name;
  document.querySelectorAll('.scope-label').forEach(label=>label.textContent=scope==='all'?'ПОРТФЕЛЬ / 03 ПРОЕКТА':planningProjects[scope].code+' / '+planningProjects[scope].direction.toUpperCase());
  $('snapshotDate').textContent=period==='q3'?'Демонстрационные данные · 04.10.2026':'Прогнозный сценарий · Q4 2026';
  renderDashboard(); renderPlanning(); renderPurchases(); renderBudget(); renderQuality(); renderChanges(); renderUsers(); renderReports(); renderTechnology();
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
  if(route==='technology'&&scope==='all'){scope=techProject;persist();render();}
  closeDrawer(); currentRoute=route;
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
  if(id!=='all'&&!projectIds.includes(id))return;
  scope=id; $('taskSearch').value=''; $('purchaseFilter').value='all'; $('userSearch').value=''; persist(); render(); navigate(currentRoute,{replace:true});
}

function fillOwners(project,selectedId) {
  const available=users.filter(user=>user.status==='active'&&user.projects.includes(project)&&user.role!=='investor');
  $('taskForm').elements.owner.innerHTML=available.map(user=>'<option value="'+escapeHtml(user.id)+'">'+escapeHtml(user.name)+'</option>').join('');
  if(available.some(user=>user.id===selectedId))$('taskForm').elements.owner.value=selectedId;
}
function openTaskForm(id=null) {
  editingTask=id; closeDrawer(); const form=$('taskForm');form.reset();
  const task=id?tasks.find(item=>item.id===id):null;
  form.elements.project.value=task?.project??(scope==='all'?'aurora':scope);
  form.elements.project.disabled=Boolean(task);
  fillOwners(form.elements.project.value,task?.ownerId);
  form.elements.title.value=task?.title??'';
  form.elements.due.value=task?.due??'2026-10-20';
  form.elements.plan.value=task?String(task.plan*1000):'';
  form.elements.plan.readOnly=Boolean(task&&(!task.proposed||task.techRequestId));
  form.elements.reason.value=task?.reason??'';
  $('taskDialogTitle').textContent=task?'Редактировать карточку':'Карточка в бэклог';
  $('saveTask').textContent=task?'Сохранить изменения':'Добавить в бэклог';
  $('taskBudgetNote').textContent=task?.techRequestId?'Оценка зафиксирована в запросе компонента. Ответственный, срок и обоснование обновятся и в связанном запросе.':task&&!task.proposed?'Бюджет утверждён. Здесь редактируются содержание, ответственный и прогнозный срок.':'Оценка карточки отображается в бюджетных заявках и ожидает утверждения.';
  $('taskDialog').showModal();form.elements.title.focus();
}
function saveTask(event) {
  event.preventDefault();const form=$('taskForm');
  if(!form.reportValidity())return;
  const title=form.elements.title.value.trim();if(!title){form.elements.title.focus();return;}
  const ownerId=form.elements.owner.value,owner=users.find(user=>user.id===ownerId);
  if(!owner){notify('Назначьте активного пользователя выбранного проекта.');return;}
  const plan=Number(form.elements.plan.value)/1000;
  if(editingTask) {
    const task=tasks.find(item=>item.id===editingTask);
    Object.assign(task,{title,ownerId,owner:owner.name,due:form.elements.due.value,forecast:displayDate(form.elements.due.value),reason:form.elements.reason.value.trim()});
    if(task.proposed&&!task.techRequestId)task.plan=task.eac=plan;
    if(task.techRequestId){const request=techRequests.find(r=>r.id===task.techRequestId);if(request){request.ownerId=task.ownerId;request.due=task.due;request.reason=task.reason;const component=techComponents.find(c=>c.id===task.componentId);if(component)addTechEvent(component,'request-edit',request.code+' · обновление карточки',task.reason,request.document,{requestId:request.id});}}
  } else {
    const project=form.elements.project.value;
    tasks.push({id:uid('task'),project,stage:'backlog',code:'WP-'+String(tasks.length+1).padStart(3,'0'),title,ownerId,owner:owner.name,baseline:displayDate(form.elements.due.value),forecast:displayDate(form.elements.due.value),due:form.elements.due.value,plan,actual:0,commitments:0,eac:plan,health:'ok',healthText:'Новая бюджетная заявка',reason:form.elements.reason.value.trim()||'Пакет работ ожидает уточнения и утверждения.',links:[],proposed:true});
  }
  const edited=Boolean(editingTask);persist();$('taskDialog').close();$('taskSearch').value='';render();notify(edited?'Изменения карточки сохранены.':'Карточка добавлена в бэклог. Бюджетная заявка отражена в разделе «Бюджет».');
}
function moveTask(id,stage) {
  const task=tasks.find(item=>item.id===id);if(!task||!stages.some(item=>item.id===stage)||task.stage===stage)return;
  const from=task.stage;task.stage=stage;
  taskEvents.push({taskId:id,from,to:stage,at:new Date().toISOString()});taskEvents=taskEvents.slice(-100);
  persist();render();notify('«'+task.title+'» → '+stages.find(item=>item.id===stage).label);
  if(selectedTask===id&&$('detailDrawer').classList.contains('open'))openTask(id);
}

function openDrawer(kicker,title,body) {
  if(!$('detailDrawer').classList.contains('open'))drawerReturnFocus=document.activeElement;
  $('drawerKicker').textContent=kicker;$('drawerTitle').textContent=title;$('drawerBody').innerHTML=body;
  $('detailDrawer').inert=false;$('detailDrawer').classList.add('open');$('detailDrawer').setAttribute('aria-hidden','false');$('closeDrawer').focus();
}
function closeDrawer() {
  const wasOpen=$('detailDrawer').classList.contains('open');$('detailDrawer').classList.remove('open');$('detailDrawer').setAttribute('aria-hidden','true');$('detailDrawer').inert=true;selectedTask=null;
  if(wasOpen&&drawerReturnFocus?.isConnected)drawerReturnFocus.focus();
}
function detailRows(rows) { return '<div class="detail-grid">'+rows.map(([label,value])=>'<div class="detail-row"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>').join('')+'</div>'; }
function openTask(id) {
  const task=tasks.find(item=>item.id===id);if(!task)return;selectedTask=id;
  const lastEvents=taskEvents.filter(item=>item.taskId===id).slice(-3).reverse();
  const body=badge(task.proposed?'Бюджетная заявка':'Утверждённый пакет',task.proposed?'warning':'neutral')+detailRows([['Проект',planningProjects[task.project].code],['Ответственный',taskOwner(task)],['Базовый срок',task.baseline],['Прогнозный срок',task.forecast],['План',money(task.plan)],['Факт / обязательства',money(task.actual)+' / '+money(task.commitments)],['EAC',money(task.eac)],['Связанные документы',task.links?.join(' · ')||'Документы ещё не приложены']])+'<div class="drawer-note">'+escapeHtml(task.reason)+'</div><label class="control"><span>Статус карточки</span><select id="taskStage">'+stages.map(stage=>'<option value="'+stage.id+'" '+(stage.id===task.stage?'selected':'')+'>'+stage.label+'</option>').join('')+'</select></label><div class="drawer-actions"><button class="btn primary" data-edit-task="'+escapeHtml(task.id)+'" type="button">Редактировать</button></div>'+(lastEvents.length?'<div style="margin-top:24px"><span class="eyebrow">ИСТОРИЯ ПЕРЕМЕЩЕНИЙ</span>'+lastEvents.map(item=>'<div class="list-row"><h3>'+stages.find(stage=>stage.id===item.from)?.label+' → '+stages.find(stage=>stage.id===item.to)?.label+'</h3><p>'+new Date(item.at).toLocaleString('ru-RU')+'</p></div>').join('')+'</div>':'');
  openDrawer('КАРТОЧКА / '+task.code,task.title,body+(task.techRequestId?'<div class="drawer-actions"><button class="btn" data-tech-request="'+escapeHtml(task.techRequestId)+'" type="button">Связанный запрос ↗</button></div><p class="form-note" style="margin-top:16px">Перемещение карточки не подтверждает испытание, приёмку или оплату. Результат верификации фиксируется в связанном запросе.</p>':''));
}
function openPurchase(id) {
  const purchase=purchases.find(item=>item.id===id);if(!purchase)return;
  selectedTask=null;const details=purchaseDetails[id];
  const trace=details?.trace??[['Проект',planningProjects[purchase.project].code],['Потребность',purchase.id+' / '+purchase.iteration],['Компонент',purchase.component],['Приёмка',purchase.accepted+' из '+purchase.quantity+' единиц'],['Брак',purchase.defect+' единиц'],['Сумма',money(purchase.amount)],['Документы',purchase.links.join(' · ')]];
  openDrawer('ЦЕПОЧКА ЗАКУПКИ',purchase.id+' · '+purchase.component,badge(purchase.status,purchase.kind)+detailRows(trace)+'<div class="drawer-note">'+escapeHtml(details?.note??(purchase.defect?'Отклонение отражено в реестре качества; решение связано с бюджетной корректировкой.':'Закупка связана с пакетом работ и реестром приёмки.'))+'</div>');
}
function openUserForm(id=null) {
  editingUser=id;const form=$('userForm');form.reset();const user=id?users.find(item=>item.id===id):null;
  $('userDialogTitle').textContent=user?user.name:'Новый пользователь';
  for(const key of ['name','email','role','status','timezone','notifications'])form.elements[key].value=user?.[key]??({role:'engineer',status:'active',timezone:'Europe/Vienna',notifications:'assigned'}[key]??'');
  form.querySelectorAll('[name=projects]').forEach(input=>input.checked=user?user.projects.includes(input.value):scope!=='all'&&scope===input.value);
  $('userFormError').hidden=true;$('userDialog').showModal();form.elements.name.focus();
}
function saveUser(event) {
  event.preventDefault();const form=$('userForm');if(!form.reportValidity())return;
  const name=form.elements.name.value.trim(),email=form.elements.email.value.trim().toLowerCase(),projects=[...form.querySelectorAll('[name=projects]:checked')].map(input=>input.value);
  const error=!name?'Укажите имя пользователя.':!projects.length?'Выберите хотя бы один проект.':users.some(user=>user.id!==editingUser&&user.email.toLowerCase()===email)?'Пользователь с таким email уже существует.':editingUser==='admin'&&form.elements.status.value==='inactive'?'Текущий администратор должен оставаться активным.':null;
  if(error){$('userFormError').textContent=error;$('userFormError').hidden=false;return;}
  const user={id:editingUser??uid('user'),name,email,projects,role:form.elements.role.value,status:form.elements.status.value,timezone:form.elements.timezone.value,notifications:form.elements.notifications.value};
  const index=users.findIndex(item=>item.id===user.id);if(index<0)users.push(user);else users[index]=user;
  persist();$('userDialog').close();$('userSearch').value='';render();notify('Настройки пользователя сохранены.');
}

function snapshot() {
  return { system:'ЭПСИЛОН', capturedAt:new Date().toISOString(), scope, scopeName:scopeName(), period, totals:totals(), projects:scopeIds().map(id=>({id,...planningProjects[id],financial:financial(id)})), tasks:tasks.filter(inScope).map(task=>({...structuredClone(task),owner:taskOwner(task)})), purchases:structuredClone(purchases.filter(inScope)), changes:structuredClone(changes.filter(inScope)), scores:healthScores(), technology:structuredClone({components:techComponents.filter(inScope),requests:techRequests.filter(inScope),events:techEvents.filter(inScope)}) };
}
function csvCell(value) { let text=String(value??'');if(/^[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'; }
function downloadReport(data,format,name) {
  let body,type,extension;
  const tech=data.technology??{components:[],requests:[],events:[]};
  if(format==='json'){body=JSON.stringify(data,null,2);type='application/json;charset=utf-8';extension='json';}
  else if(format==='excel'){
    const rows=[['ЭПСИЛОН',data.scopeName,data.period],['Финансовые показатели','EUR'],['План',data.totals.base*1000],['Факт',data.totals.actual*1000],['Обязательства',data.totals.commitments*1000],['EAC',data.totals.eac*1000],[],['КАРТОЧКИ'],['Код','Проект','Название','Статус','Ответственный','Срок','План EUR','Факт EUR','Обязательства EUR','EAC EUR','Бюджетная заявка'],...data.tasks.map(task=>[task.code,planningProjects[task.project].code,task.title,stages.find(stage=>stage.id===task.stage).label,task.owner,task.due,task.plan*1000,task.actual*1000,task.commitments*1000,task.eac*1000,task.proposed?'Да':'Нет']),[],['ЗАКУПКИ'],['Код','Проект','Компонент','Сумма EUR','Принято','Брак','Полный пакет'],...data.purchases.map(item=>[item.id,planningProjects[item.project].code,item.component,item.amount*1000,item.accepted,item.defect,item.complete?'Да':'Нет']),[],['КОРРЕКТИРОВКИ'],['Код','Проект','Причина','Влияние EUR','Статус'],...data.changes.map(item=>[item.id,planningProjects[item.project].code,item.title,item.amount*1000,item.status])];
    rows.push([],['ТЕХНОЛОГИЧЕСКАЯ КАРТА'],['Проект','Подсистема','Код','Компонент','Ревизия','На изделие','Потребность партии','Годных актуальной ревизии','Склад всего годных','Ревизия остатка','В пути актуальной ревизии','Ревизия заказа','Брак','Верификация','Основание'],...tech.components.map(c=>[planningProjects[c.project].code,c.group,c.code,c.name,c.revision,c.perUnit,c.perUnit*techProducts[c.project].batch,usableStock(c),c.stock,c.stockRevision,usableOrder(c),c.orderRevision,c.defect,techVerificationLabels[c.verification],c.document]),[],['ЗАПРОСЫ КОМПОНЕНТОВ'],['Код','Проект','Компонент','Ревизия','Тип','Статус','Обоснование','Оценка EUR','Срок','Основание'],...tech.requests.map(r=>[r.code,planningProjects[r.project].code,r.componentName,r.revision,r.type,requestLabel(r),r.reason,r.cost,r.due,r.document]),[],['ИСТОРИЯ СОСТАВА'],['Дата','Изменение','Обоснование','Документ'],...tech.events.map(e=>[e.at,e.title,e.reason,e.document]));
    body='\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');type='text/csv;charset=utf-8';extension='csv';
  }else{
    const table='<table><tr><th>Пакет работ</th><th>Проект</th><th>Статус</th><th>Ответственный</th><th>Срок</th><th>План / EAC</th></tr>'+data.tasks.map(task=>'<tr><td>'+escapeHtml(task.title)+'</td><td>'+planningProjects[task.project].code+'</td><td>'+stages.find(stage=>stage.id===task.stage).label+'</td><td>'+escapeHtml(task.owner)+'</td><td>'+displayDate(task.due)+'</td><td>'+money(task.plan)+' / '+money(task.eac)+'</td></tr>').join('')+'</table>';
    const techTable='<h2>Технологическая карта</h2><table><tr><th>Компонент</th><th>Ревизия</th><th>Годных актуальной ревизии / потребность</th><th>Брак</th><th>Верификация</th><th>Основание</th></tr>'+tech.components.map(c=>'<tr><td>'+escapeHtml(planningProjects[c.project].code+' · '+c.code+' · '+c.name)+'</td><td>'+escapeHtml(c.revision)+'</td><td>'+usableStock(c)+' / '+c.perUnit*techProducts[c.project].batch+'</td><td>'+c.defect+'</td><td>'+techVerificationLabels[c.verification]+'</td><td>'+escapeHtml(c.document)+'</td></tr>').join('')+'</table><h2>Обоснования изменений</h2>'+tech.events.map(e=>'<p><strong>'+escapeHtml(e.title)+'</strong><br>'+escapeHtml(e.reason)+'<br>Основание: '+escapeHtml(e.document)+'</p>').join('')+'<h2>Запросы компонентов</h2>'+tech.requests.map(r=>'<p><strong>'+escapeHtml(r.code+' · '+r.componentName+' · '+r.revision)+'</strong><br>'+requestLabel(r)+' · оценка '+euros(r.cost)+'<br>'+escapeHtml(r.reason)+'</p>').join('');
    body='\ufeff<html><head><meta charset="utf-8"><title>ЭПСИЛОН</title><style>body{font-family:Arial;color:#14242f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;font-size:11px}th{background:#e8f4f2;text-align:left}h1{font-size:28px}h2{font-size:18px}</style></head><body><h1>ЭПСИЛОН · Обзор проекта</h1><p>'+escapeHtml(data.scopeName)+' · '+data.period.toUpperCase()+'</p><p>Снимок: '+new Date(data.capturedAt).toLocaleString('ru-RU')+'</p><h2>Финансовые показатели</h2><p>План: '+money(data.totals.base)+'<br>Факт: '+money(data.totals.actual)+'<br>Обязательства: '+money(data.totals.commitments)+'<br>EAC: '+money(data.totals.eac)+'</p><h2>Пакеты работ</h2>'+table+'<h2>Профиль проекта</h2><p>'+data.scores.map(item=>item.label+': '+item.value+'%').join(' · ')+'</p>'+techTable+'<p>Демонстрационные данные.</p></body></html>';type='application/msword;charset=utf-8';extension='doc';
  }
  const url=URL.createObjectURL(new Blob([body],{type})),link=document.createElement('a');link.href=url;link.download=name+'.'+extension;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportReport(format) {
  const data=snapshot(),id='RPT-'+String(reportHistory.length+1).padStart(3,'0'),name='EPSILON-'+(scope==='all'?'portfolio':planningProjects[scope].code)+'-'+period+'-'+Date.now();
  downloadReport(data,format,name);reportHistory.unshift({id,name,format,snapshot:data,createdAt:data.capturedAt});reportHistory=reportHistory.slice(0,25);persist();renderReports();notify('Отчёт сформирован и сохранён в истории.');
}
function openReportDialog() { $('reportContext').textContent=scopeName()+' · '+period.toUpperCase()+' · '+tasks.filter(inScope).length+' пакетов работ';$('reportDialog').showModal(); }

document.addEventListener('click',event=>{
  const route=event.target.closest('[data-route]');if(route&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();navigate(route.dataset.route);return;}
  const close=event.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
  const project=event.target.closest('[data-project]');if(project){selectProject(project.dataset.project);return;}
  const add=event.target.closest('[data-add-task]');if(add){openTaskForm();return;}
  const edit=event.target.closest('[data-edit-task]');if(edit){openTaskForm(edit.dataset.editTask);return;}
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
$('addTask').addEventListener('click',()=>openTaskForm());$('taskForm').addEventListener('submit',saveTask);$('taskForm').elements.project.addEventListener('change',event=>fillOwners(event.target.value));
$('addUser').addEventListener('click',()=>openUserForm());$('userForm').addEventListener('submit',saveUser);
setupTechnology();
$('currentUserButton').addEventListener('click',()=>{navigate('users');openUserForm('admin');});
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
const initialRoute=parseUrl();render();navigate(initialRoute,{replace:true});

if(document.modelContext?.registerTool) {
  const register=tool=>Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});
  register({name:'get_workspace_snapshot',title:'Получить снимок ЭПСИЛОН',description:'Текущий проект, бюджет, пакеты работ и показатели.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>snapshot()});
  register({name:'set_workspace_project',title:'Выбрать проект',description:'Изменить контекст всех разделов.',inputSchema:{type:'object',properties:{project:{type:'string',enum:['all',...projectIds]}},required:['project'],additionalProperties:false},execute:input=>{if(!['all',...projectIds].includes(input.project))throw new Error('Неизвестный проект');selectProject(input.project);return snapshot();}});
}
