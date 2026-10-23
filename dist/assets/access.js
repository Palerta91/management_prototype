'use strict';

// Demonstration policy only. Production enforcement must live on the server.
const accessRoles={admin:'Администратор',leader:'Руководитель',head:'Руководитель отдела',employee:'Сотрудник'};
const accessSections={dashboard:'Сводная аналитика',planning:'Планирование',technology:'Разработки / состав изделия',production:'Производство',quality:'Контроль качества',testing:'Испытания',purchases:'Поставки',budget:'Бюджет',changes:'Корректировки',reports:'Отчёты'};
let accessState,accessTab='users',editingAccessProject=null;

function restoreProjectCatalog(data) {
  for(const [id,p] of Object.entries(data.projectCatalog??{})){
    if(!/^[\w-]{1,80}$/.test(id)||!p||!['code','name','direction','finish'].every(k=>typeof p[k]==='string')||!['base','actual','commitments','eac'].every(k=>Number.isFinite(p[k])&&p[k]>=0))continue;
    planningProjects[id]=structuredClone(p);
  }
}
function initializeAccess(data) {
  const ids=[...projectIds],state=data.access;
  const departments=[
    {id:'development',name:'Разработки',sections:['technology','changes'],projects:ids},
    {id:'production',name:'Производство',sections:['production'],projects:ids},
    {id:'quality',name:'Контроль качества',sections:['quality'],projects:ids},
    {id:'testing',name:'Испытания',sections:['testing'],projects:ids},
    {id:'supply',name:'Поставки',sections:['purchases'],projects:ids},
    {id:'management',name:'Управление',sections:[],projects:ids}
  ];
  accessState={version:1,actorId:'admin',departments,grants:[],events:[],classifications:[]};
  if(state?.version===1){
    if(Array.isArray(state.departments))accessState.departments=state.departments.filter(d=>d&&/^[\w-]+$/.test(d.id)&&typeof d.name==='string'&&Array.isArray(d.sections)&&d.sections.every(s=>s in accessSections)&&Array.isArray(d.projects)&&d.projects.every(p=>projectIds.includes(p)));
    for(const d of departments)if(!accessState.departments.some(x=>x.id===d.id))accessState.departments.push(d);
    accessState.actorId=typeof state.actorId==='string'?state.actorId:'admin';
    if(Array.isArray(state.grants))accessState.grants=state.grants.filter(g=>g&&typeof g.id==='string'&&Array.isArray(g.projects)&&g.projects.every(p=>projectIds.includes(p))&&Array.isArray(g.sections)&&g.sections.every(s=>s in accessSections)&&typeof g.expiresAt==='string'&&typeof g.reason==='string');
    if(Array.isArray(state.events))accessState.events=state.events.filter(e=>e&&typeof e.id==='string'&&typeof e.action==='string').slice(-500);
    if(Array.isArray(state.classifications))accessState.classifications=state.classifications.filter(c=>c&&typeof c.name==='string'&&typeof c.departmentId==='string');
  }
  const legacyLabels={manager:'Руководитель проекта',engineer:'Инженер',procurement:'Специалист по закупкам',investor:'Инвестор (демо)'};
  users.forEach(u=>{
    const old=u.role;
    if(!(u.role in accessRoles)){u.legacyRole??=old;u.role=old==='manager'?'head':'employee';}
    u.position??=legacyLabels[old]??(u.role==='admin'?'Системный администратор':accessRoles[u.role]);
    u.departmentId??=u.role==='admin'||old==='investor'?'management':old==='procurement'?'supply':'development';
    if(!accessState.departments.some(d=>d.id===u.departmentId))u.departmentId='development';
    u.sectionAccess??={};
  });
  if(!state?.version){
    if(!users.some(u=>u.role==='leader'))users.push({id:'director',name:'Елена Волкова',email:'director@epsilon.example',role:'leader',position:'Генеральный директор',departmentId:'management',projects:ids,status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'all'});
    for(const d of departments.filter(d=>d.id!=='management')){
      if(!users.some(u=>u.role==='head'&&u.departmentId===d.id))users.push({id:'head-'+d.id,name:{production:'Сергей Михайлов',quality:'Ольга Васильева',testing:'Роман Соколов',supply:'Марина Орлова',development:'Илья Сергеев'}[d.id],email:'head-'+d.id+'@epsilon.example',role:'head',position:'Начальник отдела «'+d.name+'»',departmentId:d.id,projects:[ids[0]],status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'all'});
    }
    users.push({id:'employee-production',name:'Андрей Морозов',email:'operator@epsilon.example',role:'employee',position:'Инженер-технолог',departmentId:'production',projects:[ids[0]],status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'assigned'});
  }
  if(!users.some(u=>u.id===accessState.actorId))accessState.actorId=users.find(u=>u.role==='admin')?.id??users[0]?.id;
  for(const id of projectIds){
    profiles[id]??={q4:{actual:0,commitments:0,eac:planningProjects[id].eac},quality:{total:0,accepted:0,gross:0,recovery:0},tests:{passed:0,total:0},docs:{complete:0,total:0},readyOrders:0,totalOrders:0};
    techProducts[id]??={name:planningProjects[id].name,version:'Новый проект · состав не задан',batch:0,due:'2026-12-31'};
  }
  tasks.forEach(t=>{t.departmentId??=users.find(u=>u.id===t.ownerId)?.departmentId??'development';});
}
function accessActor(){return users.find(u=>u.id===accessState?.actorId);}
function accessActive(u=accessActor()){return Boolean(u&&u.status==='active');}
function accessDepartment(u=accessActor()){return accessState.departments.find(d=>d.id===u?.departmentId);}
function accessProjects(u=accessActor()){
  if(!accessActive(u))return [];
  if(u.role==='leader')return [...projectIds];
  const own=u.projects.filter(p=>projectIds.includes(p));
  return u.role==='head'?own.filter(p=>accessDepartment(u)?.projects.includes(p)):own;
}
function accessGrantActive(g,now=Date.now()){
  return !g.revokedAt&&Date.parse(g.expiresAt)>now&&Date.parse(g.createdAt)<=now&&accessActive(users.find(u=>u.id===g.adminId))&&users.find(u=>u.id===g.issuedBy)?.role==='leader';
}
function accessCan(section,project,action='read',u=accessActor()){
  if(!accessActive(u)||!(section in accessSections)||!accessProjects(u).includes(project))return false;
  if(u.role==='leader')return true;
  if(u.role==='admin')return action==='read'&&accessState.grants.some(g=>g.adminId===u.id&&accessGrantActive(g)&&g.projects.includes(project)&&g.sections.includes(section));
  if(u.sectionAccess?.[section]==='deny')return false;
  if(section==='planning')return action==='read'||action==='write';
  if(u.role==='employee'&&['dashboard','budget','reports'].includes(section))return false;
  const own=accessDepartment(u)?.sections.includes(section);
  if(u.sectionAccess?.[section]==='read')return action==='read';
  return Boolean(own&&(action==='read'||action==='write'||action==='verify'&&u.role==='head'));
}
function accessCanAdmin(u=accessActor()){return accessActive(u)&&['admin','leader','head'].includes(u.role);}
function accessCanRoute(route){
  if(route==='access-denied')return true;
  if(['admin','users'].includes(route))return accessCanAdmin();
  return accessProjects().some(p=>accessCan(route,p));
}
function accessScopeProjects(route=currentRoute){
  const ids=accessProjects();
  return ['admin','users','access-denied'].includes(route)?ids:ids.filter(p=>accessCan(route,p));
}
function accessHome(){return !accessActive()?'access-denied':accessCanAdmin()?'admin':accessProjects().length?'planning':'access-denied';}
function accessRequire(section,project,action='read'){
  if(accessCan(section,project,action))return true;
  notify('Нет полномочий: '+(accessSections[section]??section)+'.');return false;
}
function accessCanManageUser(target){
  const a=accessActor();if(!accessCanAdmin())return false;
  return a.role!=='head'||target?.role==='employee'&&target.departmentId===a.departmentId;
}
function accessCanChangeRole(target,newRole){
  const a=accessActor();if(!accessActive()||!['admin','leader'].includes(a.role)||!(newRole in accessRoles))return false;
  if(a.role==='leader')return true;
  return target?.id!==a.id&&target?.role!=='leader'&&newRole!=='leader';
}
function accessCanReadConversation(conversation,u=accessActor()){
  if(!accessActive(u)||u.role==='admin')return false;
  if(conversation.type==='direct')return conversation.participants.includes(u.id);
  return u.role==='leader'||conversation.participants.includes(u.id);
}
function accessCanEditTask(t){
  if(!t||!accessCan('planning',t.project,'write'))return false;
  const a=accessActor();return ['leader','head'].includes(a.role)||a.role==='employee'&&(t.createdBy===a.id||t.ownerId===a.id);
}
function accessTaskVisible(t){return accessCan('planning',t.project)&&(accessActor().role!=='employee'||(t.departmentId??users.find(u=>u.id===t.ownerId)?.departmentId)===accessActor().departmentId||t.ownerId===accessActor().id||t.createdBy===accessActor().id);}
function accessCanFinance(project){return accessActor()?.role==='leader'||accessCan('budget',project);}
function accessTaskCard(task){
  return '<button class="kanban-card" draggable="'+accessCanEditTask(task)+'" data-task="'+escapeHtml(task.id)+'" style="--card-color:#63a7ff" type="button"><span class="card-project">'+escapeHtml(planningProjects[task.project].code+' · '+task.code)+'</span><h3>'+escapeHtml(task.title)+'</h3><p class="form-note">'+escapeHtml(accessState.departments.find(d=>d.id===task.departmentId)?.name??'Рабочая задача')+'</p><span class="card-owner"><span>'+escapeHtml(taskOwner(task))+'</span><time>'+displayDate(task.due)+'</time></span>'+(task.awaitingAccess?'<span class="card-proposal">Исполнителю нужен допуск к проекту</span>':'')+'</button>';
}
function accessOpenTask(task){
  if(!accessTaskVisible(task)){notify('Нет допуска к карточке.');return;}
  selectedTask=task.id;const canEdit=accessCanEditTask(task);
  openDrawer('ЗАДАЧА / '+task.code,task.title,detailRows([['Проект',planningProjects[task.project].code],['Исполнитель',taskOwner(task)],['Срок',displayDate(task.due)],['Статус',stages.find(s=>s.id===task.stage)?.label]])+'<div class="drawer-note">'+escapeHtml(task.reason)+'</div>'+(task.awaitingAccess?'<p class="form-note">Исполнителю не открыт проект. Назначение задачи не выдаёт доступ автоматически.</p>':'')+(canEdit?'<label class="control"><span>Статус задачи</span><select id="taskStage">'+stages.map(s=>'<option value="'+s.id+'"'+(s.id===task.stage?' selected':'')+'>'+s.label+'</option>').join('')+'</select></label><div class="drawer-actions"><button class="btn" data-edit-task="'+task.id+'" type="button">Редактировать задачу</button></div>':''));
}
function accessAudit(action,target,reason,details={}){
  accessState.events.push({id:uid('audit'),at:new Date().toISOString(),actorId:accessActor()?.id,actorName:accessActor()?.name,action,target,reason,...structuredClone(details)});
  accessState.events=accessState.events.slice(-500);
}
function accessOptions(items,selected){return items.map(x=>'<option value="'+escapeHtml(x.id)+'"'+(x.id===selected?' selected':'')+'>'+escapeHtml(x.name)+'</option>').join('');}
function accessProjectChecks(name,selected,ids=projectIds,disabled=false){return ids.map(id=>'<label><input type="checkbox" name="'+name+'" value="'+id+'"'+(selected.includes(id)?' checked':'')+(disabled?' disabled':'')+' />'+escapeHtml(planningProjects[id].code)+'</label>').join('');}
function accessChecked(form,name){return [...form.querySelectorAll('[name="'+name+'"]:checked')].map(i=>i.value);}
function accessFillProjectSelect(select,section){const ids=accessProjects().filter(id=>accessCan(section,id,'write'));select.innerHTML=ids.map(id=>'<option value="'+id+'">'+escapeHtml(planningProjects[id].code)+'</option>').join('');select.value=ids.includes(scope)?scope:ids[0]??'';}
function accessFormError(id,message){$(id).textContent=message;$(id).hidden=false;}

function renderAccessUI(){
  const a=accessActor();document.body.dataset.accessRole=a?.role??'';
  $('demoActor').innerHTML=accessOptions(users.map(u=>({id:u.id,name:u.name+' · '+accessRoles[u.role]+(u.status==='active'?'':' · ЗАБЛОКИРОВАН')})),a?.id);
  $('currentUserInitials').textContent=initials(a?.name??'—');
  const generated={dashboard:['dashboardMetrics','spendChart','statusChart','radarChart','projectCards','attentionList'],planning:['kanbanBoard','boardStats'],technology:['techProduct','techMetrics','techRows','techBlockerList','techRequestList','techHistory'],production:['productionMetrics','productionChart','productionStatus','productionShipmentRows','productionDefectRows','productionCostRows','productionRunRows'],purchases:['purchaseMetrics','purchaseRows','techPurchaseInbox'],quality:['qualityMetrics','qualityList','testList','techVerificationInbox'],testing:['testingRequests','testingResults'],budget:['budgetMetrics','waterfall','iterationBudget','proposedBudget'],changes:['changeMetrics','changeList'],reports:['reportHistory'],admin:['adminUserRows','adminAccessRows','adminProjectRows','adminAuditRows','incidentRows']};
  for(const [route,ids] of Object.entries(generated))if(!accessCanRoute(route))for(const id of ids)$(id).innerHTML='';
  document.querySelectorAll('.sidebar nav [data-route]').forEach(el=>el.hidden=!accessCanRoute(el.dataset.route));
  const ids=accessScopeProjects();$('projectSelect').innerHTML=(ids.length>1?'<option value="all">Все доступные проекты · '+ids.length+'</option>':'')+ids.map(id=>'<option value="'+id+'">'+escapeHtml(planningProjects[id].code+' · '+planningProjects[id].name)+'</option>').join('');$('projectSelect').value=scope;
  if(!ids.length)$('projectSelect').innerHTML='<option value="all">Нет доступных проектов</option>';
  const readonly=scopeIds().length&&!scopeIds().some(p=>accessCan(currentRoute,p,'write'));
  $('accessReadOnly').hidden=!readonly||!accessSections[currentRoute];
  const note=a?.role==='admin'?'Администратор управляет учётными записями. Данные разделов — только по временному допуску руководителя.':a?.role==='head'?'Контур: '+(accessDepartment()?.name??'—')+'. Смена ролей и допусков — у администратора или руководителя.':a?.role==='employee'?'Сотрудник: задачи и информация своего отдела. Сводная аналитика и администрирование недоступны.':'Руководитель: все проекты и разделы. Личные чаты сотрудников исключены.';
  $('accessContext').textContent=note;
  $('addTask').disabled=!scopeIds().some(p=>accessCan('planning',p,'write'));
  $('addComponent').hidden=!scopeIds().some(p=>accessCan('technology',p,'write'));
  $('addProductionRun').hidden=!scopeIds().some(p=>accessCan('production',p,'write'));
  $('addProductionDefect').hidden=!scopeIds().some(p=>accessCan('production',p,'write'));
  document.querySelectorAll('[data-export],#dashboardExport,#budgetExport,#reportExport,.production-export').forEach(el=>el.hidden=a?.role!=='leader');
  if(currentRoute==='production')document.querySelectorAll('[data-production-ship],[data-production-defect]').forEach(el=>el.hidden=!scopeIds().some(p=>accessCan('production',p,'verify')));
  document.querySelectorAll('.metrics,.production-overview,.board-stats,.dashboard-charts').forEach(el=>{el.hidden=a?.role==='employee';if(a?.role==='employee'&&el.id)el.innerHTML='';});
  if(a?.role!=='leader')$('boardStats').innerHTML='';
  $('productionCostRows').closest('article').hidden=a?.role==='employee';
  if(a?.role==='employee')$('productionCostRows').innerHTML='';
  for(const id of ['techProjectSelect'])$(id).innerHTML=scopeIds().map(p=>'<option value="'+p+'">'+escapeHtml(planningProjects[p].code+' · '+planningProjects[p].name)+'</option>').join('');
  if(currentRoute==='technology')$('techProjectSelect').value=techProject;
  if(!accessActive())$('accessDeniedText').textContent=a?.blockReason?'Учётная запись заблокирована во всех проектах и разделах. Основание: '+a.blockReason:'Учётная запись неактивна. Обратитесь к администратору.';
}
function renderAccessPortal(){
  if(!accessCanAdmin())return;
  const a=accessActor(),head=a.role==='head';
  const tabs={users:'Пользователи',...(head?{}:{access:'Допуски к данным',incidents:'Доступ по инцидентам',projects:'Проекты и бюджеты'}),departments:'Отделы и справочники',matrix:'Правила ролей',...(head?{}:{audit:'Журнал действий'})};
  if(!(accessTab in tabs))accessTab='users';
  $('adminTabs').innerHTML=Object.entries(tabs).map(([id,label])=>'<button class="admin-tab" role="tab" aria-selected="'+(id===accessTab)+'" data-admin-tab="'+id+'" type="button">'+label+'</button>').join('');
  $('adminPanelTitle').textContent=head?'Команда отдела «'+accessDepartment().name+'»':'Администрирование';
  const people=users.filter(u=>!head||u.departmentId===a.departmentId);
  $('adminUserRows').innerHTML=people.filter(u=>[u.name,u.email,u.position,accessRoles[u.role],accessDepartment(u)?.name].join(' ').toLowerCase().includes($('adminUserSearch').value.trim().toLowerCase())).map(u=>'<tr><td><strong>'+escapeHtml(u.name)+'</strong><small>'+escapeHtml(u.email)+'</small></td><td><strong>'+escapeHtml(u.position)+'</strong><small>'+escapeHtml(accessDepartment(u)?.name??'—')+'</small></td><td>'+badge(accessRoles[u.role],u.role==='leader'?'good':u.role==='admin'?'warning':'neutral')+'</td><td>'+escapeHtml(u.projects.map(p=>planningProjects[p]?.code).filter(Boolean).join(' · '))+'</td><td>'+badge(u.status==='active'?'Активен':u.status==='blocked'?'Заблокирован':'Неактивен',u.status==='active'?'good':'risk')+'</td><td><div class="admin-row-actions">'+(accessCanManageUser(u)?'<button class="btn small" data-user="'+u.id+'" type="button">Настроить</button>':'')+(a.role==='admin'?'<button class="btn small '+(u.status==='blocked'?'':'danger')+'" data-block-user="'+u.id+'" type="button"'+(u.id===a.id?' disabled':'')+'>'+(u.status==='blocked'?'Разблокировать':'Блокировать')+'</button>':'')+'</div></td></tr>').join('');
  document.querySelectorAll('[data-admin-panel]').forEach(el=>el.hidden=el.dataset.adminPanel!==accessTab);
  $('adminAddProject').hidden=a.role!=='leader';$('adminAddDepartment').hidden=a.role!=='leader';$('adminIssueGrant').hidden=a.role!=='leader';
  $('adminIncidentNote').textContent=a.role==='leader'?'Только чтение. Выберите администратора, проекты, разделы, номер инцидента и срок. Руководитель может отозвать допуск немедленно.':'Администратор не выдаёт допуск себе. Запросите его у руководителя; чаты, экспорт и изменение данных исключены.';
  const grants=accessState.grants.filter(g=>a.role==='leader'||g.adminId===a.id);
  $('incidentRows').innerHTML=grants.length?grants.slice().reverse().map(g=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(g.incident+' · '+(users.find(u=>u.id===g.adminId)?.name??'Администратор'))+'</h3>'+badge(g.revokedAt?'Отозван':accessGrantActive(g)?'Действует':'Истёк',accessGrantActive(g)?'warning':'neutral')+'</div><p>'+escapeHtml(g.reason)+'</p><p>'+escapeHtml(g.projects.map(p=>planningProjects[p].code).join(' · '))+' / '+escapeHtml(g.sections.map(s=>accessSections[s]).join(', '))+'</p><p>До '+escapeHtml(new Date(g.expiresAt).toLocaleString('ru-RU'))+' · выдал '+escapeHtml(users.find(u=>u.id===g.issuedBy)?.name??'Руководитель')+'</p>'+(g.revokedAt?'<p>Основание отзыва: '+escapeHtml(g.revokeReason)+'</p>':'')+(a.role==='leader'&&accessGrantActive(g)?'<button class="btn small danger" data-revoke-grant="'+g.id+'" type="button">Отозвать доступ</button>':'')+'</div>').join(''):empty('Временных допусков пока нет. Доступ к данным не открыт.');
  $('adminAccessRows').innerHTML=people.map(u=>'<tr><td><strong>'+escapeHtml(u.name)+'</strong><small>'+accessRoles[u.role]+'</small></td><td>'+escapeHtml(u.projects.map(p=>planningProjects[p]?.code).filter(Boolean).join(', '))+'</td><td>'+escapeHtml(u.role==='leader'?'Все разделы':u.role==='admin'?'Только по действующему инциденту':accessDepartment(u)?.sections.map(s=>accessSections[s]).join(', ')||'Не назначены')+'</td><td>'+escapeHtml(Object.entries(u.sectionAccess??{}).filter(([,v])=>v!=='inherit').map(([s,v])=>(accessSections[s]??s)+': '+(v==='deny'?'закрыто':'только чтение')).join('; ')||'По роли и отделу')+'</td><td><button class="btn small" data-user="'+u.id+'" type="button">Допуски</button></td></tr>').join('');
  $('adminDepartments').innerHTML=accessState.departments.filter(d=>!head||d.id===a.departmentId).map(d=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(d.name)+'</h3>'+badge(d.id===a.departmentId?'Мой отдел':'Отдел')+'</div><p>'+escapeHtml(d.projects.map(p=>planningProjects[p].code).join(' · '))+'</p><p>'+escapeHtml(d.sections.map(s=>accessSections[s]).join(', ')||'Организационные функции; бизнес-данные не открыты')+'</p></div>').join('');
  $('classificationDepartment').innerHTML=accessOptions(accessState.departments.filter(d=>a.role==='leader'||d.id===a.departmentId),a.departmentId);
  $('classificationForm').hidden=!['leader','head'].includes(a.role);
  $('classificationRows').innerHTML=accessState.classifications.filter(c=>a.role==='leader'||c.departmentId===a.departmentId).map(c=>'<div class="list-row"><h3>'+escapeHtml(c.name)+'</h3><p>'+escapeHtml(accessState.departments.find(d=>d.id===c.departmentId)?.name)+' · '+escapeHtml(c.kind==='entity'?'Сущность справочника':'Классификация')+'</p></div>').join('')||empty('Сущности и классификации отдела ещё не добавлены.');
  $('adminProjectRows').innerHTML=projectIds.map(id=>{const p=planningProjects[id];return '<tr><td><strong>'+escapeHtml(p.code+' · '+p.name)+'</strong><small>'+escapeHtml(p.direction)+'</small></td><td>'+escapeHtml(a.role==='leader'?(p.description??'Описание ещё не заполнено'):'Описание доступно руководителю')+'</td><td>'+(a.role==='leader'?money(p.base):'Не предоставлено')+'</td><td>'+(a.role==='leader'?'<button class="btn small" data-edit-project="'+id+'" type="button">Редактировать</button>':'Только метаданные')+'</td></tr>';}).join('');
  $('adminAuditRows').innerHTML=accessState.events.slice(-60).reverse().map(e=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(e.action)+'</h3><span class="unit">'+escapeHtml(new Date(e.at).toLocaleString('ru-RU'))+'</span></div><p>'+escapeHtml(e.actorName+' → '+e.target)+'</p><p>'+escapeHtml(a.role==='admin'&&e.action.startsWith('Проект')?'Содержание изменения доступно руководителю':e.reason)+'</p>'+(a.role==='leader'&&(e.before||e.after)?'<p class="admin-audit-detail">'+escapeHtml(JSON.stringify(e.before??{}))+' → '+escapeHtml(JSON.stringify(e.after??{}))+'</p>':'')+'</div>').join('')||empty('Изменения доступа будут зафиксированы здесь. Тексты переписок не журналируются.');
}
function openAccessUserForm(id=null){
  const a=accessActor(),u=id?users.find(x=>x.id===id):null,self=u?.id===a?.id;
  if(!accessActive()||(!self&&!accessCanAdmin())||(u&&!self&&!accessCanManageUser(u))){notify('Нет права изменять этого пользователя.');return;}
  editingUser=id;const f=$('userForm');f.reset();const head=a.role==='head',manage=accessCanAdmin()&&(!u||accessCanManageUser(u));
  $('userDialogTitle').textContent=u?'Профиль · '+u.name:'Добавить сотрудника';
  for(const k of ['name','email','position','timezone','notifications'])f.elements[k].value=u?.[k]??({timezone:'Europe/Vienna',notifications:'assigned'}[k]??'');
  f.elements.position.readOnly=!manage;f.elements.email.readOnly=!manage;f.elements.name.readOnly=!manage&&!self;
  const allowedRoles=a.role==='leader'?Object.keys(accessRoles):a.role==='admin'?['admin','head','employee']:['employee'];
  f.elements.role.innerHTML=Object.entries(accessRoles).filter(([r])=>allowedRoles.includes(r)||r===u?.role).map(([r,label])=>'<option value="'+r+'">'+label+'</option>').join('');f.elements.role.value=u?.role??'employee';f.elements.role.disabled=!manage||head||self&&a.role==='admin'||u?.role==='leader'&&a.role!=='leader';
  f.elements.departmentId.innerHTML=accessOptions(accessState.departments.filter(d=>!head||d.id===a.departmentId),u?.departmentId??a.departmentId);f.elements.departmentId.disabled=!manage||head;
  const canProjects=manage&&(!head||!u)&&!(self&&a.role==='admin')&&!(u?.role==='leader'&&a.role!=='leader');
  $('userProjectChecks').innerHTML=accessProjectChecks('projects',u?.projects??[],head?accessProjects():projectIds,!canProjects);
  f.elements.status.value=u?.status??'active';f.elements.status.disabled=true;
  $('userAccessMatrix').innerHTML=Object.entries(accessSections).map(([s,label])=>'<label class="admin-permission-line"><span>'+label+'</span><select name="section-'+s+'"'+(!manage||head||self&&a.role==='admin'||u?.role==='leader'?' disabled':'')+'><option value="inherit">По роли и отделу</option><option value="read"'+(u?.sectionAccess?.[s]==='read'?' selected':'')+'>Только чтение</option><option value="deny"'+(u?.sectionAccess?.[s]==='deny'?' selected':'')+'>Нет доступа</option></select></label>').join('');
  $('userAccessControls').hidden=!manage||head;$('userAccessReason').hidden=!manage;f.elements.accessReason.required=Boolean(manage&&u&&!self);
  $('userRoleHint').textContent=head?'Новому сотруднику назначается роль «Сотрудник». Смена роли и допусков существующего пользователя недоступна.':a.role==='admin'?'Администратор не меняет свою роль и не назначает руководителей. Должность не открывает доступ к данным.':'Роль задаёт полномочия, должность — трудовую функцию. Личные переписки сотрудников исключены из административного доступа.';
  $('userFormError').hidden=true;$('userDialog').showModal();f.elements.name.focus();
}
function saveAccessUser(event){
  event.preventDefault();const f=$('userForm');if(!f.reportValidity())return;const a=accessActor(),old=users.find(u=>u.id===editingUser),self=old?.id===a?.id,head=a?.role==='head',manage=accessCanAdmin()&&(!old||accessCanManageUser(old));
  if(!accessActive()||!manage&&!self)return accessFormError('userFormError','Полномочия отозваны. Изменение не сохранено.');
  const name=f.elements.name.value.trim(),email=f.elements.email.value.trim().toLowerCase(),position=f.elements.position.value.trim(),role=manage&&!head?f.elements.role.value:old?.role??'employee',departmentId=manage&&!head?f.elements.departmentId.value:old?.departmentId??a.departmentId;
  const canProjects=manage&&(!head||!old)&&!(self&&a.role==='admin')&&!(old?.role==='leader'&&a.role!=='leader');
  const projects=canProjects?accessChecked(f,'projects'):old?.projects??[];
  const error=!name||!email?'Укажите имя и email.':manage&&!position?'Укажите должность — она не заменяет роль.':users.some(u=>u.id!==old?.id&&u.email.toLowerCase()===email)?'Такой email уже зарегистрирован.':!accessState.departments.some(d=>d.id===departmentId)?'Выберите отдел.':projects.some(p=>!projectIds.includes(p)||head&&!accessProjects().includes(p))?'Недопустимый проект.':role!==old?.role&&!(!old&&head&&role==='employee')&&!accessCanChangeRole(old,role)?'Нет права назначать эту роль.':old?.role==='leader'&&role!=='leader'&&users.filter(u=>u.role==='leader'&&u.status==='active').length<=1?'Нельзя изменить роль последнего активного руководителя.':null;
  if(error)return accessFormError('userFormError',error);
  if(manage&&old&&!self&&!f.elements.accessReason.value.trim())return accessFormError('userFormError','Укажите основание изменения профиля и доступа.');
  const sectionAccess=structuredClone(old?.sectionAccess??{});
  if(manage&&!head&&!(self&&a.role==='admin')&&old?.role!=='leader')for(const section of Object.keys(accessSections)){const value=f.elements['section-'+section]?.value??'inherit';if(!['inherit','read','deny'].includes(value))return accessFormError('userFormError','Неверный режим доступа.');sectionAccess[section]=value;}
  const next={...(old??{}),id:old?.id??uid('user'),name,email:manage?email:old.email,position:manage?position:old.position,role,departmentId,projects,status:old?.status??'active',sectionAccess,timezone:f.elements.timezone.value,notifications:f.elements.notifications.value};
  if(old)users[users.indexOf(old)]=next;else users.push(next);
  accessAudit(old?'Профиль и права изменены':'Пользователь добавлен',next.name,f.elements.accessReason.value.trim()||'Настройки пользователя',{before:old?{role:old.role,position:old.position,departmentId:old.departmentId,projects:old.projects,sectionAccess:old.sectionAccess}:null,after:{role:next.role,position:next.position,departmentId:next.departmentId,projects:next.projects,sectionAccess:next.sectionAccess}});
  persist();$('userDialog').close();render();notify('Профиль сохранён. Роль и должность учитываются отдельно.');
}
function openAccessBlock(id){
  const u=users.find(x=>x.id===id);if(accessActor()?.role!=='admin'||!accessActive()||!u||u.id===accessActor().id){notify('Блокировка недоступна.');return;}
  const f=$('accessBlockForm');f.reset();f.elements.userId.value=id;$('accessBlockTitle').textContent=(u.status==='blocked'?'Разблокировать: ':'Тотальная блокировка: ')+u.name;$('accessBlockError').hidden=true;$('accessBlockDialog').showModal();
}
function saveAccessBlock(event){
  event.preventDefault();const f=$('accessBlockForm');if(!f.reportValidity())return;const u=users.find(x=>x.id===f.elements.userId.value),reason=f.elements.reason.value.trim();
  if(!accessActive()||accessActor().role!=='admin'||!u||u.id===accessActor().id||!reason)return accessFormError('accessBlockError','Нет права на блокировку или не указано основание.');
  if(u.status!=='blocked'&&['leader','admin'].includes(u.role)&&users.filter(x=>x.role===u.role&&x.status==='active').length<=1)return accessFormError('accessBlockError','Нельзя заблокировать последнего активного '+(u.role==='leader'?'руководителя.':'администратора.'));
  const before=u.status;u.status=before==='blocked'?'active':'blocked';u.blockReason=reason;u.blockedAt=new Date().toISOString();
  if(u.status==='blocked')accessState.grants.filter(g=>g.adminId===u.id&&!g.revokedAt).forEach(g=>{g.revokedAt=new Date().toISOString();g.revokeReason='Тотальная блокировка пользователя';});
  accessAudit(u.status==='blocked'?'Тотальная блокировка':'Разблокировка',u.name,reason,{before:{status:before},after:{status:u.status}});persist();$('accessBlockDialog').close();render();notify('Статус учётной записи обновлён во всём демо-контуре.');
}
function openAccessGrant(){
  if(!accessActive()||accessActor().role!=='leader')return;const f=$('incidentForm');f.reset();f.elements.adminId.innerHTML=accessOptions(users.filter(u=>u.role==='admin'&&u.status==='active'));
  $('incidentProjects').innerHTML=accessProjectChecks('projects',[]);$('incidentSections').innerHTML=Object.entries(accessSections).filter(([s])=>s!=='reports').map(([s,label])=>'<label><input type="checkbox" name="sections" value="'+s+'" />'+label+'</label>').join('');$('incidentError').hidden=true;$('incidentDialog').showModal();
}
function saveAccessGrant(event){
  event.preventDefault();const f=$('incidentForm');if(!f.reportValidity())return;const admin=users.find(u=>u.id===f.elements.adminId.value),projects=accessChecked(f,'projects'),sections=accessChecked(f,'sections'),hours=Number(f.elements.hours.value),reason=f.elements.reason.value.trim(),incident=f.elements.incident.value.trim();
  if(!accessActive()||accessActor().role!=='leader'||admin?.role!=='admin'||!accessActive(admin)||!projects.length||projects.some(p=>!admin.projects.includes(p)||!projectIds.includes(p))||!sections.length||sections.some(s=>!(s in accessSections)||s==='reports')||![1,4,24].includes(hours)||!reason||!incident)return accessFormError('incidentError','Проверьте полномочия, проекты администратора, разделы, инцидент и срок. Чаты и экспорт не допускаются.');
  const grant={id:uid('grant'),adminId:admin.id,projects,sections,reason,incident,issuedBy:accessActor().id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+hours*3600000).toISOString()};
  accessState.grants.push(grant);accessAudit('Выдан временный доступ',admin.name,incident+' · '+reason,{after:grant});persist();$('incidentDialog').close();render();notify('Допуск выдан только на чтение. Он истечёт автоматически.');
}
function revokeAccessGrant(id,reason){
  const g=accessState.grants.find(x=>x.id===id);if(!accessActive()||accessActor().role!=='leader'||!g||!accessGrantActive(g)||!reason.trim())return false;
  g.revokedAt=new Date().toISOString();g.revokeReason=reason.trim();accessAudit('Временный доступ отозван',users.find(u=>u.id===g.adminId)?.name??g.adminId,reason,{after:{grantId:id,incident:g.incident}});persist();return true;
}
function openAccessDepartment(){
  if(accessActor()?.role!=='leader'||!accessActive())return;const f=$('departmentForm');f.reset();$('departmentProjects').innerHTML=accessProjectChecks('projects',[]);$('departmentSections').innerHTML=Object.entries(accessSections).filter(([s])=>!['dashboard','planning','budget','reports'].includes(s)).map(([s,label])=>'<label><input type="checkbox" name="sections" value="'+s+'" />'+label+'</label>').join('');$('departmentError').hidden=true;$('departmentDialog').showModal();
}
function saveAccessDepartment(event){
  event.preventDefault();const f=$('departmentForm');if(!f.reportValidity())return;const name=f.elements.name.value.trim(),projects=accessChecked(f,'projects'),sections=accessChecked(f,'sections');
  if(!accessActive()||accessActor().role!=='leader'||!name||accessState.departments.some(d=>d.name.toLowerCase()===name.toLowerCase())||projects.some(p=>!projectIds.includes(p))||sections.some(s=>!(s in accessSections)||['dashboard','planning','budget','reports'].includes(s)))return accessFormError('departmentError','Проверьте название, проекты и функциональные разделы отдела.');
  accessState.departments.push({id:uid('dept'),name,projects,sections});accessAudit('Отдел создан',name,'Настройка организационной структуры',{after:{projects,sections}});persist();$('departmentDialog').close();render();
}
function saveAccessClassification(event){
  event.preventDefault();const f=$('classificationForm');if(!f.reportValidity())return;const a=accessActor(),departmentId=f.elements.departmentId.value,name=f.elements.name.value.trim(),kind=f.elements.kind.value;
  if(!accessActive()||!['leader','head'].includes(a.role)||a.role==='head'&&departmentId!==a.departmentId||!accessState.departments.some(d=>d.id===departmentId)||!name||!['entity','classification'].includes(kind)){notify('Нет права изменять этот справочник.');return;}
  if(accessState.classifications.some(c=>c.departmentId===departmentId&&c.kind===kind&&c.name.toLowerCase()===name.toLowerCase())){notify('Такая запись уже есть в отделе.');return;}
  accessState.classifications.push({id:uid('class'),departmentId,name,kind});accessAudit('Добавлена запись справочника',name,accessDepartment()?.name??'Управление',{after:{departmentId,kind}});persist();f.elements.name.value='';renderAccessPortal();
}
function openAccessProject(id=null){
  if(!accessActive()||accessActor().role!=='leader')return;editingAccessProject=id;const p=planningProjects[id],f=$('accessProjectForm');f.reset();
  for(const k of ['code','name','direction','description'])f.elements[k].value=p?.[k]??'';f.elements.base.value=p?p.base*1000:'';f.elements.finish.value=p?isoDate(p.finish):'2026-12-31';
  $('projectDepartmentChecks').innerHTML=accessState.departments.map(d=>'<label><input type="checkbox" name="departments" value="'+d.id+'"'+(id&&d.projects.includes(id)?' checked':'')+' />'+escapeHtml(d.name)+'</label>').join('');
  $('accessProjectError').hidden=true;$('accessProjectDialog').showModal();
}
function saveAccessProject(event){
  event.preventDefault();const f=$('accessProjectForm');if(!f.reportValidity())return;const v=k=>f.elements[k].value.trim(),base=Number(v('base'))/1000,reason=v('reason'),departments=accessChecked(f,'departments');
  if(!accessActive()||accessActor().role!=='leader'||!v('code')||!v('name')||!v('direction')||['code','name','direction'].some(k=>/[<>]/.test(v(k)))||!reason||!Number.isFinite(base)||base<0||base>100000||!validProductionDate(v('finish'))||departments.some(id=>!accessState.departments.some(d=>d.id===id))||projectIds.some(id=>id!==editingAccessProject&&planningProjects[id].code.toLowerCase()===v('code').toLowerCase()))return accessFormError('accessProjectError','Проверьте уникальный код, описание, отделы, бюджет, срок и основание. HTML в названии не допускается.');
  const id=editingAccessProject??uid('project'),before=planningProjects[id]?structuredClone(planningProjects[id]):null;
  planningProjects[id]={...(before??{actual:0,commitments:0,eac:0,riskCount:0,alertCard:''}),code:v('code'),name:v('name'),direction:v('direction'),description:v('description'),base,finish:displayDate(v('finish'))};
  if(!before){projectIds.push(id);profiles[id]={q4:{actual:0,commitments:0,eac:0},quality:{total:0,accepted:0,gross:0,recovery:0},tests:{passed:0,total:0},docs:{complete:0,total:0},readyOrders:0,totalOrders:0};techProducts[id]={name:v('name'),version:'Новый проект · состав не задан',batch:0,due:v('finish')};}
  for(const d of accessState.departments){if(departments.includes(d.id)){if(!d.projects.includes(id))d.projects.push(id);}else d.projects=d.projects.filter(p=>p!==id);}
  accessAudit(before?'Проект и плановый бюджет изменены':'Проект создан',v('code'),reason,{before:before?{description:before.description,base:before.base}:null,after:{description:v('description'),base,departments,financialUnit:'тыс. руб.'}});persist();$('accessProjectDialog').close();render();notify('Проект сохранён. Изменение плана не переопределяет факт, обязательства и EAC.');
}
function renderTestingWorkspace(){
  const rows=techRequests.filter(inScope).filter(r=>r.type==='verification');
  $('testingRequests').innerHTML=renderTechRequestList(rows);
  $('testingResults').innerHTML=tests.filter(inScope).map(t=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(t.id+' · '+t.title)+'</h3>'+badge(t.status,t.kind)+'</div><p>'+escapeHtml(t.result)+'</p></div>').join('')||empty('Результатов пока нет.');
}
function accessSafeSnapshot(){
  if(accessActor()?.role==='leader')return snapshot();
  return {system:'ЭПСИЛОН',demo:true,actor:{id:accessActor()?.id,role:accessActor()?.role},projects:accessProjects().map(id=>({id,code:planningProjects[id].code})),sections:Object.keys(accessSections).filter(s=>accessProjects().some(p=>accessCan(s,p))),tasks:tasks.filter(accessTaskVisible).map(t=>({id:t.id,project:t.project,title:t.title,stage:t.stage,due:t.due,owner:taskOwner(t)}))};
}
function setupAccess(){
  $('demoActor').addEventListener('change',e=>{accessState.actorId=e.target.value;document.querySelectorAll('dialog[open]').forEach(d=>d.close());closeDrawer();persist();navigate(accessHome());});
  $('adminUserSearch').addEventListener('input',renderAccessPortal);$('adminAddUser').addEventListener('click',()=>openAccessUserForm());
  $('adminIssueGrant').addEventListener('click',openAccessGrant);$('adminAddDepartment').addEventListener('click',openAccessDepartment);$('adminAddProject').addEventListener('click',()=>openAccessProject());
  for(const [id,fn] of [['accessBlockForm',saveAccessBlock],['incidentForm',saveAccessGrant],['departmentForm',saveAccessDepartment],['classificationForm',saveAccessClassification],['accessProjectForm',saveAccessProject]])$(id).addEventListener('submit',fn);
  $('accessRevokeForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target;if(f.reportValidity()&&revokeAccessGrant(f.elements.grantId.value,f.elements.reason.value)){$('accessRevokeDialog').close();render();}else accessFormError('accessRevokeError','Нет права отзыва или срок допуска уже истёк.');});
  document.addEventListener('click',e=>{const tab=e.target.closest('[data-admin-tab]'),block=e.target.closest('[data-block-user]'),revoke=e.target.closest('[data-revoke-grant]'),project=e.target.closest('[data-edit-project]');if(tab){accessTab=tab.dataset.adminTab;renderAccessPortal();}if(block)openAccessBlock(block.dataset.blockUser);if(project)openAccessProject(project.dataset.editProject);if(revoke&&accessActor()?.role==='leader'){const f=$('accessRevokeForm');f.reset();f.elements.grantId.value=revoke.dataset.revokeGrant;$('accessRevokeError').hidden=true;$('accessRevokeDialog').showModal();}});
  window.setInterval(()=>{if(accessActor()?.role==='admin'&&currentRoute in accessSections){if(!accessCanRoute(currentRoute)){document.querySelectorAll('dialog[open]').forEach(d=>d.close());navigate('admin');notify('Временный допуск истёк или отозван.');}else render();}},15000);
  window.addEventListener('storage',event=>{
    if(event.key!==storageKey||!event.newValue)return;
    try{
      const next=normalizeRubDemoData(JSON.parse(event.newValue));if(next.access?.version!==1||!Array.isArray(next.users))return;
      const actorId=accessState.actorId;restoreProjectCatalog(next);for(const id of Object.keys(planningProjects))if(!projectIds.includes(id))projectIds.push(id);
      if(!next.users.every(validUser))return;
      users=next.users;initializeAccess({...next,access:{...next.access,actorId}});document.querySelectorAll('dialog[open]').forEach(d=>d.close());navigate(accessCanRoute(currentRoute)?currentRoute:accessHome(),{replace:true});
    }catch{/* Ignore malformed demo state; never silently broaden access. */}
  });
}
