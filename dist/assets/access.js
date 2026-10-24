'use strict';

// Shared UI policy, also executed by server/policy.mjs for account mutations.
// Shared permission policy. Task data has a separate PostgreSQL API; other
// business records in this MVP remain test data rather than a server-side ERP.
const accessRoles={admin:'Администратор',leader:'Руководитель',head:'Руководитель отдела',project_manager:'Руководитель проектов',employee:'Сотрудник',unassigned:'Роль не назначена'};
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
  accessState={version:1,governanceVersion:1,actorId:'admin',departments,grants:[],events:[],classifications:[],superAdminId:null,transfers:[]};
  if(state?.version===1){
    if(Array.isArray(state.departments))accessState.departments=state.departments.filter(d=>d&&/^[\w-]+$/.test(d.id)&&typeof d.name==='string'&&Array.isArray(d.sections)&&d.sections.every(s=>s in accessSections)&&Array.isArray(d.projects)&&d.projects.every(p=>projectIds.includes(p)));
    for(const d of departments)if(!accessState.departments.some(x=>x.id===d.id))accessState.departments.push(d);
    accessState.actorId=typeof state.actorId==='string'?state.actorId:'admin';
    if(Array.isArray(state.grants))accessState.grants=state.grants.filter(g=>g&&typeof g.id==='string'&&Array.isArray(g.projects)&&g.projects.every(p=>projectIds.includes(p))&&Array.isArray(g.sections)&&g.sections.every(s=>s in accessSections)&&typeof g.expiresAt==='string'&&typeof g.reason==='string');
    if(Array.isArray(state.events))accessState.events=state.events.filter(e=>e&&typeof e.id==='string'&&typeof e.action==='string').slice(-500);
    if(Array.isArray(state.classifications))accessState.classifications=state.classifications.filter(c=>c&&typeof c.name==='string'&&typeof c.departmentId==='string');
    if(state.governanceVersion===1){accessState.superAdminId=typeof state.superAdminId==='string'?state.superAdminId:null;accessState.transfers=Array.isArray(state.transfers)?state.transfers.filter(t=>t&&typeof t.id==='string'&&['pending','approved','rejected','cancelled'].includes(t.status)):[];}
  }
  const legacyLabels={manager:'Руководитель проекта',engineer:'Инженер',procurement:'Специалист по закупкам',investor:'Инвестор (демо)'};
  users.forEach(u=>{
    const old=u.role;
    if(!Object.hasOwn(accessRoles,u.role)){u.legacyRole??=old;u.role=old==='manager'?'head':'employee';}
    u.position??=legacyLabels[old]??(u.role==='admin'?'Системный администратор':accessRoles[u.role]);
    u.departmentId??=u.role==='admin'||old==='investor'?'management':old==='procurement'?'supply':'development';
    if(!accessState.departments.some(d=>d.id===u.departmentId))u.departmentId='';
    if(u.role==='unassigned'){u.departmentId='';u.projects=[];u.sectionAccess={};}
    u.sectionAccess??={};
  });
  if(!state?.version){
    if(!users.some(u=>u.role==='leader'))users.push({id:'director',name:'Елена Волкова',email:'director@epsilon.example',role:'leader',position:'Генеральный директор',departmentId:'management',projects:ids,status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'all'});
    for(const d of departments.filter(d=>d.id!=='management')){
      if(!users.some(u=>u.role==='head'&&u.departmentId===d.id))users.push({id:'head-'+d.id,name:{production:'Сергей Михайлов',quality:'Ольга Васильева',testing:'Роман Соколов',supply:'Марина Орлова',development:'Илья Сергеев'}[d.id],email:'head-'+d.id+'@epsilon.example',role:'head',position:'Начальник отдела «'+d.name+'»',departmentId:d.id,projects:[ids[0]],status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'all'});
    }
    users.push({id:'employee-production',name:'Андрей Морозов',email:'operator@epsilon.example',role:'employee',position:'Инженер-технолог',departmentId:'production',projects:[ids[0]],status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'assigned'});
  }
  // Elect only on the first migration. A missing holder in an already migrated
  // workspace must not silently promote another account.
  if(state?.governanceVersion!==1)accessState.superAdminId=users.find(u=>u.role==='leader'&&accessActive(u))?.id??null;
  if(state?.governanceVersion!==1)for(const [id,name,position] of [['leader-operations','Анна Крылова','Исполнительный директор'],['leader-strategy','Павел Громов','Директор по развитию']])if(!users.some(u=>u.id===id))users.push({id,name,email:id+'@epsilon.example',role:'leader',position,departmentId:'management',projects:ids,status:'active',sectionAccess:{},timezone:'Europe/Vienna',notifications:'all'});
  if(state?.governanceVersion!==1&&!users.some(u=>u.role==='project_manager'))users.push({id:'project-manager',name:'Дмитрий Лебедев',email:'projects@epsilon.example',role:'project_manager',position:'Руководитель проекта AURORA',departmentId:'development',projects:[ids[0]],status:'active',sectionAccess:{},pmAccess:{[ids[0]]:{planning:'write',technology:'read',testing:'read'}},pmDeadlines:[ids[0]],timezone:'Europe/Vienna',notifications:'assigned'});
  if(!users.some(u=>u.id===accessState.actorId))accessState.actorId=users.find(u=>u.role==='admin')?.id??users[0]?.id;
  for(const id of projectIds){
    profiles[id]??={q4:{actual:0,commitments:0,eac:planningProjects[id].eac},quality:{total:0,accepted:0,gross:0,recovery:0},tests:{passed:0,total:0},docs:{complete:0,total:0},readyOrders:0,totalOrders:0};
    techProducts[id]??={name:planningProjects[id].name,version:'Новый проект · состав не задан',batch:0,due:'2026-12-31'};
  }
  tasks.forEach(t=>{t.departmentId??=users.find(u=>u.id===t.ownerId)?.departmentId??'development';});
}
function accessActor(){return users.find(u=>u.id===accessState?.actorId);}
function accessActive(u=accessActor()){return Boolean(u&&u.status==='active');}
function accessSuper(u=accessActor()){return accessActive(u)&&u.role==='leader'&&u.id===accessState.superAdminId;}
function accessRoleLabel(u){return accessRoles[u.role]+(u.id===accessState.superAdminId?' · Суперадмин':'');}
function accessDepartment(u=accessActor()){return accessState.departments.find(d=>d.id===u?.departmentId);}
function accessProjects(u=accessActor()){
  if(!accessActive(u)||u.role==='unassigned'||!['leader','admin'].includes(u.role)&&!accessDepartment(u))return [];
  if(u.role==='leader')return [...projectIds];
  const own=u.projects.filter(p=>projectIds.includes(p));
  return u.role==='head'||u.departmentManaged?own.filter(p=>accessDepartment(u)?.projects.includes(p)):own;
}
function accessGrantActive(g,now=Date.now()){
  const issuer=users.find(u=>u.id===g.issuedBy);
  return !g.revokedAt&&Date.parse(g.expiresAt)>now&&Date.parse(g.createdAt)<=now&&accessActive(users.find(u=>u.id===g.adminId))&&accessActive(issuer)&&issuer.role==='leader';
}
function accessCan(section,project,action='read',u=accessActor()){
  if(!accessActive(u)||accessOnboardingRequired(u)||!Object.hasOwn(accessSections,section)||!accessProjects(u).includes(project))return false;
  if(u.role==='leader')return true;
  if(u.role==='admin')return action==='read'&&accessState.grants.some(g=>g.adminId===u.id&&accessGrantActive(g)&&g.projects.includes(project)&&g.sections.includes(section));
  if(u.role==='project_manager'){
    const mode=u.pmAccess?.[project]?.[section]??(section==='planning'?'read':'none');
    return action==='read'?['read','write','verify'].includes(mode):action==='write'?['write','verify'].includes(mode):action==='verify'&&mode==='verify';
  }
  if(u.sectionAccess?.[section]==='deny')return false;
  if(u.role==='employee'&&['dashboard','budget','reports'].includes(section))return false;
  // Explicit read-only grants are issued by the company leader/admin, not by a
  // limited team manager. They may extend a membership ceiling, never its write rights.
  if(u.sectionAccess?.[section]==='read')return action==='read';
  if(u.membershipAccess){const mode=u.membershipAccess[project]?.[section]??'none';if(action==='read'?!['read','write'].includes(mode):action==='write'?mode!=='write':true)return false;}
  if(section==='planning')return action==='read'||action==='write';
  const own=accessDepartment(u)?.sections.includes(section);
  return Boolean(own&&(action==='read'||action==='write'||action==='verify'&&u.role==='head'));
}
function accessCanAdmin(u=accessActor()){return accessActive(u)&&!accessOnboardingRequired(u)&&['admin','leader','head','project_manager'].includes(u.role);}
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
  if(target?.status==='deleted')return false;
  if(!target)return true;
  if(accessSuper())return true;
  if(a.id===target.id)return true;
  if(a.role==='head')return ['employee','project_manager'].includes(target.role)&&target.departmentId===a.departmentId||target.role==='employee'&&organizationCanEdit(target.departmentId)&&target.projects.every(p=>accessProjects().includes(p));
  if(a.role==='project_manager')return target.role==='employee'&&organizationCanEdit(target.departmentId)&&target.projects.every(p=>accessProjects().includes(p));
  if(target.role==='leader'||a.role==='leader'&&target.role==='admin')return false;
  return true;
}
function accessCanChangeRole(target,newRole){
  const a=accessActor();if(!accessActive()||!['admin','leader'].includes(a.role)||!Object.hasOwn(accessRoles,newRole))return false;
  if(target?.id===accessState.superAdminId&&newRole!=='leader')return false;
  if(target&&!accessCanManageUser(target))return false;
  if(a.role==='leader')return true;
  return target?.id!==a.id&&target?.role!=='leader'&&newRole!=='leader';
}
function accessCanUserAction(target,action){
  const a=accessActor();
  if(!accessActive()||!target||target.id===a.id||target.id===accessState.superAdminId||target.status==='deleted')return false;
  if(action==='delete')return accessSuper();
  if(!['block','revoke','restore'].includes(action))return false;
  if(accessSuper())return true;
  if(a.role==='admin')return target.role!=='leader'&&(action!=='block'||target.role!=='admin'||users.filter(u=>u.role==='admin'&&accessActive(u)).length>1||target.status==='blocked');
  return a.role==='leader'&&!['leader','admin'].includes(target.role);
}
function accessCanConfigurePM(target){return accessActive()&&(accessActor().role==='leader'||accessActor().role==='head'&&target?.departmentId===accessActor().departmentId);}
function accessCanSetDeadline(project,u=accessActor()){return accessCan('planning',project,'write',u)&&(['leader','head'].includes(u.role)||u.role==='project_manager'&&u.pmDeadlines?.includes(project));}
function accessCanReadConversation(conversation,u=accessActor()){
  if(!accessActive(u)||accessOnboardingRequired(u)||u.role==='admin')return false;
  if(conversation.type==='direct')return conversation.participants.includes(u.id);
  return u.role==='leader'||conversation.participants.includes(u.id);
}
function accessCanManageTask(t){
  if(!t||!accessCan('planning',t.project,'read'))return false;
  const id=accessActor()?.id;return t.createdBy===id||(t.editorIds??[]).includes(id);
}
function accessCanShareTask(t){return Boolean(t&&accessCan('planning',t.project,'read')&&t.createdBy===accessActor()?.id);}
function accessCanMoveTask(t){
  if(!t||!accessCan('planning',t.project,'read'))return false;
  const a=accessActor();if(['leader','head','project_manager'].includes(a.role)&&accessCan('planning',t.project,'write'))return true;
  return t.createdBy===a.id||t.ownerId===a.id||(t.coExecutorIds??[]).includes(a.id)||(t.editorIds??[]).includes(a.id);
}
function accessCanEditTask(t){return accessCanManageTask(t);}
function accessTaskVisible(t){return accessCan('planning',t.project)&&(accessActor().role!=='employee'||(t.departmentId??users.find(u=>u.id===t.ownerId)?.departmentId)===accessActor().departmentId||t.ownerId===accessActor().id||t.createdBy===accessActor().id||t.coExecutorIds?.includes(accessActor().id)||t.editorIds?.includes(accessActor().id));}
function accessCanFinance(project){return accessActor()?.role==='leader'||accessCan('budget',project);}
function accessTaskCard(task){
  return '<button class="kanban-card" draggable="'+accessCanMoveTask(task)+'" data-task="'+escapeHtml(task.id)+'" style="--card-color:#63a7ff" type="button"><span class="card-project">'+escapeHtml(planningProjects[task.project].code+' · '+task.code)+'</span><h3>'+escapeHtml(task.title)+'</h3><p class="form-note">'+escapeHtml(accessState.departments.find(d=>d.id===task.departmentId)?.name??'Рабочая задача')+'</p><span class="card-owner"><span>'+escapeHtml(taskOwner(task))+'</span><time>'+displayDate(task.due)+'</time></span>'+(task.awaitingAccess?'<span class="card-proposal">Исполнителю нужен допуск к проекту</span>':'')+'</button>';
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
function accessPMSummary(u){return u.projects.map(p=>planningProjects[p]?.code+': '+Object.entries(u.pmAccess?.[p]??{planning:'read'}).filter(([,v])=>v!=='none').map(([s,v])=>(accessSections[s]??s)+' / '+({read:'чтение',write:'изменение',verify:'верификация'}[v]??v)).join(', ')).join('; ');}
function renderAccessPMControls(){
  const f=$('userForm'),u=users.find(x=>x.id===editingUser),pm=f.elements.role.value==='project_manager',head=['head','project_manager'].includes(accessActor().role);
  const editable=accessCanConfigurePM(u??{departmentId:f.elements.departmentId.value});$('userPMControls').hidden=!pm||!editable;$('userAccessControls').hidden=pm||head||!accessCanAdmin();
  if(!pm||!editable)return;
  const ids=head?accessProjects():projectIds;
  $('userPMMatrix').innerHTML=ids.map(p=>'<section class="pm-project"><h3>'+escapeHtml(planningProjects[p].code+' · '+planningProjects[p].name)+'</h3><p class="form-note">Права действуют только при наличии допуска к этому проекту.</p>'+Object.entries(accessSections).map(([s,label])=>{
    const current=u?.pmAccess?.[p]?.[s]??(s==='planning'?'read':'none'),modes=['none','read','write','verify'].filter(m=>s!=='planning'||m!=='none');
    return '<label class="admin-permission-line"><span>'+label+'</span><select name="pm-'+p+'-'+s+'">'+modes.map(m=>'<option value="'+m+'"'+(m===current?' selected':'')+'>'+({none:'Нет доступа',read:'Чтение',write:'Чтение и изменение',verify:'Изменение и верификация'}[m])+'</option>').join('')+'</select></label>';
  }).join('')+'<label class="pm-deadline"><input type="checkbox" name="pm-deadlines" value="'+p+'"'+(u?.pmDeadlines?.includes(p)?' checked':'')+' /> Изменение сроков любых карточек проекта (нужно право изменения планирования)</label></section>').join('');
  $('userPMNote').textContent=editable?'Выдавайте только необходимые права. Руководитель отдела не может делегировать больше своих полномочий. Роль назначают администратор или руководитель.':'Права этой роли настраивают руководитель или руководитель отдела. Администратор управляет учётной записью, но не выдаёт эти бизнес-полномочия.';
}
function accessReadPMForm(next,old,f){
  let pmAccess=structuredClone(old?.pmAccess??{}),pmDeadlines=[...(old?.pmDeadlines??[])];
  if(!accessCanConfigurePM(next))return {pmAccess,pmDeadlines};
  const head=accessActor().role==='head',ids=head?accessProjects():projectIds,checked=accessChecked(f,'pm-deadlines');
  if(checked.some(p=>!ids.includes(p)))return {error:'Недопустимый проект в правах на сроки.'};
  for(const p of ids){
    const current=pmAccess[p]??{},permissions={};
    for(const s of Object.keys(accessSections)){
      const previous=current[s]??(s==='planning'?'read':'none'),mode=f.elements['pm-'+p+'-'+s]?.value??previous;
      if(!['none','read','write','verify'].includes(mode)||s==='planning'&&mode==='none')return {error:'Некорректный уровень прав руководителя проектов.'};
      if(head&&mode!==previous&&mode!=='none'&&!accessCan(s,p,mode==='verify'?'verify':mode==='write'?'write':'read'))return {error:'Нельзя делегировать полномочия, которых нет у вас: '+accessSections[s]+'.'};
      permissions[s]=mode;
    }
    if(checked.includes(p)&&(!['write','verify'].includes(permissions.planning)||!accessCanSetDeadline(p)))return {error:'Для управления сроками необходимо право изменения планирования и соответствующие полномочия выдающего.'};
    pmAccess[p]=permissions;
  }
  pmAccess=Object.fromEntries(Object.entries(pmAccess).filter(([p])=>next.projects.includes(p)));
  pmDeadlines=[...pmDeadlines.filter(p=>!ids.includes(p)),...checked].filter(p=>next.projects.includes(p));
  return {pmAccess,pmDeadlines};
}
function accessTransferValid(t){
  if(!t||t.status!=='pending'||t.fromId!==accessState.superAdminId||new Set([t.fromId,t.toId,t.approverId]).size!==3)return false;
  return [t.fromId,t.toId,t.approverId].every(id=>{const u=users.find(x=>x.id===id);return accessActive(u)&&u.role==='leader';});
}
function renderAccessGovernance(){
  if(accessActor()?.role!=='leader'){ $('superAdminPanel').innerHTML='';$('superTransferRows').innerHTML='';$('deletedUserRows').innerHTML='';return; }
  const holder=users.find(u=>u.id===accessState.superAdminId),pending=accessState.transfers.some(accessTransferValid),leaders=users.filter(u=>accessActive(u)&&u.role==='leader'&&u.id!==accessState.superAdminId);
  $('superAdminPanel').innerHTML='<div class="superadmin-holder"><span class="eyebrow">ЕДИНСТВЕННЫЙ ВЛАДЕЛЕЦ ПОЛНОМОЧИЙ</span><h2>'+escapeHtml(holder?.name??'Владелец не определён — требуется восстановление сервером')+'</h2><p>Полный контур управления пользователями. Удаление и блокировка любых других ролей. Чужие личные переписки закрыты.</p>'+badge('Руководитель · Суперадмин','super')+'</div><div class="transfer-flow"><span>01 / Запрос Суперадмина</span><span>02 / Подтверждение третьего руководителя</span><span>03 / Полномочия новому владельцу</span></div>'+(accessSuper()?'<form id="superTransferForm" class="admin-inline-form"><label class="control"><span>Новый Суперадмин *</span><select name="toId" required>'+accessOptions(leaders)+'</select></label><label class="control"><span>Подтверждающий руководитель *</span><select name="approverId" required>'+accessOptions(leaders.slice().reverse())+'</select></label><label class="control full"><span>Основание передачи *</span><textarea name="reason" required maxlength="1200" rows="2"></textarea></label><p class="form-note full">Три разных активных руководителя. До подтверждения права не меняются. После передачи текущий владелец останется обычным руководителем.</p><button class="btn primary" type="submit"'+(pending||leaders.length<2?' disabled':'')+'>Запросить передачу</button>'+(leaders.length<2?'<p class="form-note">Нужны ещё два активных руководителя: получатель и подтверждающий.</p>':'')+'<p class="form-error full" id="superTransferError" role="alert" hidden></p></form>':'<p class="admin-explanation">Запрос создаёт только действующий Суперадмин. Подтвердить его может только указанный третий руководитель.</p>');
  const labels={pending:'Ожидает подтверждения',approved:'Передано',rejected:'Отклонено',cancelled:'Отменено'};
  $('superTransferRows').innerHTML=accessState.transfers.slice().reverse().map(t=>{
    const name=id=>users.find(u=>u.id===id)?.name??id,valid=accessTransferValid(t);
    return '<article class="list-row"><div class="list-row-top"><h3>'+escapeHtml(name(t.fromId)+' → '+name(t.toId))+'</h3>'+badge(t.status==='pending'&&!valid?'Условия больше не выполнены':labels[t.status],t.status==='approved'?'good':valid?'warning':'neutral')+'</div><p>Подтверждающий: '+escapeHtml(name(t.approverId))+'</p><p>'+escapeHtml(t.reason)+'</p><p class="unit">'+escapeHtml(new Date(t.createdAt).toLocaleString('ru-RU'))+'</p>'+(t.decisionReason?'<p>Решение: '+escapeHtml(t.decisionReason)+'</p>':'')+'<div class="admin-row-actions">'+(valid&&t.approverId===accessActor().id?'<button class="btn primary" data-transfer-decision="approve" data-transfer-id="'+t.id+'" type="button">Подтвердить передачу</button><button class="btn danger" data-transfer-decision="reject" data-transfer-id="'+t.id+'" type="button">Отклонить</button>':'')+(t.status==='pending'&&accessSuper()?'<button class="btn" data-transfer-decision="cancel" data-transfer-id="'+t.id+'" type="button">Отменить запрос</button>':'')+'</div></article>';
  }).join('')||empty('Запросов на передачу пока нет.');
  $('deletedUsersArchive').hidden=!accessSuper();
  $('deletedUserRows').innerHTML=accessSuper()?users.filter(u=>u.status==='deleted').map(u=>'<div class="list-row"><h3>'+escapeHtml(u.name)+'</h3><p>'+escapeHtml(accessRoleLabel(u)+' · '+(accessDepartment(u)?.name??'—')+' · '+u.position)+'</p><p>Удалил: '+escapeHtml(users.find(x=>x.id===u.deletedBy)?.name??u.deletedBy??'—')+' · '+escapeHtml(new Date(u.deletedAt).toLocaleString('ru-RU'))+'</p><p>'+escapeHtml(u.blockReason??'')+'</p><p class="form-note">Доступ закрыт. История авторства, задач и документов сохранена.</p></div>').join('')||empty('Удалённых учётных записей нет.'):'';
}
function saveAccessTransfer(event){
  event.preventDefault();const f=$('superTransferForm');if(!f.reportValidity())return;
  const t={id:uid('transfer'),fromId:accessActor()?.id,toId:f.elements.toId.value,approverId:f.elements.approverId.value,reason:f.elements.reason.value.trim(),createdAt:new Date().toISOString(),status:'pending'};
  if(!accessSuper()||!accessTransferValid(t)||!t.reason||accessState.transfers.some(accessTransferValid))return accessFormError('superTransferError','Нужны три разных активных руководителя и основание. Другой действующий запрос не должен ожидать подтверждения.');
  accessState.transfers.push(t);accessAudit('Запрошена передача Суперадмина',users.find(u=>u.id===t.toId).name,t.reason,{after:structuredClone(t)});persist();render();notify('Запрос ожидает подтверждения третьего руководителя. Полномочия пока не изменились.');
}
function openAccessTransferDecision(id,decision){
  const t=accessState.transfers.find(t=>t.id===id);
  if(!t||!(decision==='cancel'?accessSuper()&&t.status==='pending':accessTransferValid(t)&&t.approverId===accessActor()?.id))return;
  const f=$('transferDecisionForm');f.reset();f.elements.transferId.value=id;f.elements.decision.value=decision;
  $('transferDecisionTitle').textContent={approve:'Подтвердить передачу Суперадмина',reject:'Отклонить передачу',cancel:'Отменить передачу'}[decision];
  $('transferDecisionContext').textContent=(users.find(u=>u.id===t.fromId)?.name??t.fromId)+' → '+(users.find(u=>u.id===t.toId)?.name??t.toId)+'. При подтверждении прежний владелец утратит полномочия Суперадмина.';
  $('transferDecisionError').hidden=true;$('transferDecisionDialog').showModal();
}
function saveAccessTransferDecision(event){
  event.preventDefault();const f=$('transferDecisionForm');if(!f.reportValidity())return;
  const t=accessState.transfers.find(t=>t.id===f.elements.transferId.value),decision=f.elements.decision.value,reason=f.elements.reason.value.trim();
  if(!reason||!['approve','reject','cancel'].includes(decision)||!t||!(decision==='cancel'?accessSuper()&&t.status==='pending':accessTransferValid(t)&&t.approverId===accessActor()?.id))return accessFormError('transferDecisionError','Полномочия или состав руководителей изменились. Операция не выполнена.');
  const before=accessState.superAdminId;t.status={approve:'approved',reject:'rejected',cancel:'cancelled'}[decision];t.decidedAt=new Date().toISOString();t.decidedBy=accessActor().id;t.decisionReason=reason;
  if(decision==='approve')accessState.superAdminId=t.toId;
  accessAudit(decision==='approve'?'Полномочия Суперадмина переданы':decision==='reject'?'Передача Суперадмина отклонена':'Запрос передачи отменён',users.find(u=>u.id===t.toId)?.name,reason,{before:{superAdminId:before},after:{superAdminId:accessState.superAdminId,transferId:t.id,confirmedBy:t.decidedBy}});
  persist();$('transferDecisionDialog').close();render();notify(decision==='approve'?'Передача подтверждена. В системе один новый Суперадмин.':'Решение сохранено. Полномочия не изменились.');
}

function renderAccessUI(){
  const a=accessActor();document.body.dataset.accessRole=a?.role??'';
  $('demoActor').innerHTML=accessOptions(users.filter(u=>u.status!=='deleted'||u.id===a?.id).map(u=>({id:u.id,name:u.name+' · '+accessRoleLabel(u)+(u.status==='active'?'':' · '+accessStatusLabel(u))})),a?.id);
  $('currentUserInitials').textContent=initials(a?.name??'—');
  if(globalThis.epsilonAuth){$('demoActor').closest('label').hidden=true;$('demoActor').disabled=true;$('authAccountLabel').hidden=false;$('authAccountLabel').textContent=a?.name+' · '+accessRoleLabel(a);$('logoutButton').hidden=false;document.querySelector('.access-demo-notice .eyebrow').textContent='ЗАЩИЩЁННЫЙ РАБОЧИЙ КОНТУР / ТЕСТОВЫЕ ДАННЫЕ';document.querySelector('.access-demo-notice small').textContent='Учётные записи, права и задачи планирования хранятся на сервере в PostgreSQL. Остальные рабочие разделы пока содержат тестовые данные и не являются производственными реестрами. Модуль переписок не реализован.';document.querySelector('.sidebar-foot').innerHTML='<span class="live-dot"></span>Защищённое рабочее пространство';}
  const generated={dashboard:['dashboardMetrics','spendChart','statusChart','radarChart','projectCards','attentionList'],planning:['kanbanBoard','boardStats'],production:['productionMetrics','productionChart','productionStatus','productionShipmentRows','productionDefectRows','productionCostRows','productionRunRows'],purchases:['purchaseMetrics','purchaseRows','techPurchaseInbox'],quality:['qualityMetrics','qualityList','testList','techVerificationInbox'],testing:['testingRequests','testingResults'],budget:['budgetMetrics','waterfall','iterationBudget','proposedBudget'],changes:['changeMetrics','changeList'],reports:['reportHistory'],admin:['adminUserRows','adminAccessRows','adminProjectRows','adminAuditRows','incidentRows','superAdminPanel','superTransferRows','deletedUserRows']};
  for(const [route,ids] of Object.entries(generated))if(!accessCanRoute(route))for(const id of ids)$(id).innerHTML='';
  document.querySelectorAll('.sidebar nav [data-route]').forEach(el=>el.hidden=!accessCanRoute(el.dataset.route));
  const ids=accessScopeProjects();$('projectSelect').innerHTML=(ids.length>1?'<option value="all">Все доступные проекты · '+ids.length+'</option>':'')+ids.map(id=>'<option value="'+id+'">'+escapeHtml(planningProjects[id].code+' · '+planningProjects[id].name)+'</option>').join('');$('projectSelect').value=scope;
  if(!ids.length)$('projectSelect').innerHTML='<option value="all">Нет доступных проектов</option>';
  const readonly=scopeIds().length&&!scopeIds().some(p=>accessCan(currentRoute,p,'write'));
  $('accessReadOnly').hidden=!readonly||!accessSections[currentRoute];
  const note=accessSuper()?'Суперадмин: все проекты, разделы и пользователи. Передача полномочий — с подтверждением третьего руководителя. Личные чаты закрыты.':a?.role==='admin'?'Администратор управляет учётными записями, но не блокирует руководителей. Данные разделов — по временному допуску.':a?.role==='head'?'Контур: '+(accessDepartment()?.name??'—')+'. Можно настраивать права руководителей проектов своего отдела в пределах собственных полномочий.':a?.role==='project_manager'?'Руководитель проектов: только назначенные проекты и явно выданные права. Настройки определяет руководитель или руководитель отдела.':a?.role==='employee'?'Сотрудник: задачи и информация своего отдела. Сводная аналитика и администрирование недоступны.':'Руководитель: все проекты и разделы. Администраторы и другие руководители защищены от блокировки. Личные чаты закрыты.';
  $('accessContext').textContent=note;
  $('addTask').disabled=!scopeIds().some(p=>accessCan('planning',p,'write'));
  $('addProductionRun').hidden=!scopeIds().some(p=>accessCan('production',p,'write'));
  $('addProductionDefect').hidden=!scopeIds().some(p=>accessCan('production',p,'write'));
  document.querySelectorAll('[data-export],#dashboardExport,#budgetExport,#reportExport,.production-export').forEach(el=>el.hidden=a?.role!=='leader');
  if(currentRoute==='production')document.querySelectorAll('[data-production-ship],[data-production-defect]').forEach(el=>el.hidden=!scopeIds().some(p=>accessCan('production',p,'verify')));
  document.querySelectorAll('.metrics,.production-overview,.board-stats,.dashboard-charts').forEach(el=>{el.hidden=a?.role==='employee';if(a?.role==='employee'&&el.id)el.innerHTML='';});
  if(a?.role!=='leader')$('boardStats').innerHTML='';
  $('productionCostRows').closest('article').hidden=a?.role==='employee';
  if(a?.role==='employee')$('productionCostRows').innerHTML='';
  if(accessOnboardingRequired())$('accessDeniedText').textContent=organizationWaitingMessage;
  else if(!accessActive())$('accessDeniedText').textContent=accessStatusLabel(a??{})+'. Доступ ко всем проектам и разделам закрыт.'+(a?.blockReason?' Основание: '+a.blockReason:' Обратитесь к администратору.');
}
function accessStatusLabel(u){return u.status==='active'?'Активен':u.status==='blocked'?'Заблокирован':u.status==='deleted'?'Учётная запись удалена':u.accessRevokedAt?'Доступ отозван':'Неактивен';}
function accessUserActions(u){
  return '<div class="admin-row-actions">'+(accessCanManageUser(u)?'<button class="btn small" data-user="'+u.id+'" type="button">Настроить</button>':'')+(globalThis.authCanResetUser?.(u)?'<button class="btn small" data-password-reset="'+u.id+'" type="button">Новый временный пароль</button>':'')+(accessCanUserAction(u,'block')?'<button class="btn small '+(u.status==='blocked'?'':'danger')+'" data-block-user="'+u.id+'" type="button">'+(u.status==='blocked'?'Разблокировать':'Блокировать')+'</button>':'')+(accessCanUserAction(u,'revoke')&&u.status==='active'?'<button class="btn small" data-user-action="revoke" data-target-user="'+u.id+'" type="button">Отозвать доступ</button>':'')+(accessCanUserAction(u,'restore')&&u.status==='inactive'?'<button class="btn small" data-user-action="restore" data-target-user="'+u.id+'" type="button">Вернуть доступ</button>':'')+(accessCanUserAction(u,'delete')?'<button class="btn small danger" data-user-action="delete" data-target-user="'+u.id+'" type="button">Удалить</button>':'')+'</div>';
}
function accessRoster(people){
  const query=$('adminUserSearch').value.trim().toLowerCase(),rank={leader:0,admin:1,head:2,project_manager:3,employee:4,unassigned:5};
  const filtered=people.filter(u=>[u.name,u.email,u.position,accessRoleLabel(u),accessDepartment(u)?.name].join(' ').toLowerCase().includes(query));
  return [...accessState.departments.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru')),{id:'',name:'Ожидают назначения'}].map(d=>{
    const rows=filtered.filter(u=>u.departmentId===d.id).sort((a,b)=>rank[a.role]-rank[b.role]||a.name.localeCompare(b.name,'ru'));
    if(!rows.length)return '';
    return '<tr class="admin-department-row"><th colspan="6" scope="rowgroup">'+escapeHtml(d.name)+'</th></tr>'+rows.map(u=>'<tr><td><strong>'+escapeHtml(u.name)+'</strong><small>'+escapeHtml(u.email)+'</small></td><td>'+escapeHtml(u.position)+'</td><td>'+badge(accessRoleLabel(u),u.id===accessState.superAdminId?'super':u.role==='leader'?'good':u.role==='admin'?'warning':'neutral')+'</td><td>'+escapeHtml(u.role==='leader'?'Все проекты':u.projects.map(p=>planningProjects[p]?.code).filter(Boolean).join(' · ')||'Не назначены')+'</td><td>'+badge(accessStatusLabel(u),u.status==='active'?'good':'risk')+'</td><td>'+accessUserActions(u)+'</td></tr>').join('');
  }).join('')||'<tr><td colspan="6">Пользователи не найдены</td></tr>';
}
function renderAccessPortal(){
  if(!accessCanAdmin())return;
  const a=accessActor(),head=['head','project_manager'].includes(a.role);
  const tabs={users:'Пользователи',...(head?{}:{access:'Допуски к данным',incidents:'Доступ по инцидентам',projects:'Проекты и бюджеты'}),departments:'Структура предприятия',matrix:'Правила ролей',...(a.role==='leader'?{governance:'Суперадмин / передача'}:{}),...(globalThis.epsilonAuth?.canHandleRecovery?{credentials:'Пароли и восстановление'}:{}),...(head?{}:{audit:'Журнал действий'})};
  if(!(accessTab in tabs))accessTab='users';
  $('adminTabs').innerHTML=Object.entries(tabs).map(([id,label])=>'<button class="admin-tab" role="tab" aria-selected="'+(id===accessTab)+'" data-admin-tab="'+id+'" type="button">'+label+'</button>').join('');
  $('adminPanelTitle').textContent=head?'Команда отдела «'+accessDepartment().name+'»':'Администрирование';
  const people=users.filter(u=>u.status!=='deleted'&&(!head||organizationDepartments().includes(u.departmentId)));
  $('adminUserRows').innerHTML=accessRoster(people);
  document.querySelectorAll('[data-admin-panel]').forEach(el=>el.hidden=el.dataset.adminPanel!==accessTab);
  globalThis.renderAuthPanel?.();
  $('adminAddProject').hidden=a.role!=='leader';$('adminAddDepartment').hidden=!organizationCanManage();$('adminIssueGrant').hidden=a.role!=='leader';
  $('adminIncidentNote').textContent=a.role==='leader'?'Только чтение. Выберите администратора, проекты, разделы, номер инцидента и срок. Руководитель может отозвать допуск немедленно.':'Администратор не выдаёт допуск себе. Запросите его у руководителя; чаты, экспорт и изменение данных исключены.';
  const grants=accessState.grants.filter(g=>a.role==='leader'||g.adminId===a.id);
  $('incidentRows').innerHTML=grants.length?grants.slice().reverse().map(g=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(g.incident+' · '+(users.find(u=>u.id===g.adminId)?.name??'Администратор'))+'</h3>'+badge(g.revokedAt?'Отозван':accessGrantActive(g)?'Действует':'Истёк',accessGrantActive(g)?'warning':'neutral')+'</div><p>'+escapeHtml(g.reason)+'</p><p>'+escapeHtml(g.projects.map(p=>planningProjects[p].code).join(' · '))+' / '+escapeHtml(g.sections.map(s=>accessSections[s]).join(', '))+'</p><p>До '+escapeHtml(new Date(g.expiresAt).toLocaleString('ru-RU'))+' · выдал '+escapeHtml(users.find(u=>u.id===g.issuedBy)?.name??'Руководитель')+'</p>'+(g.revokedAt?'<p>Основание отзыва: '+escapeHtml(g.revokeReason)+'</p>':'')+(a.role==='leader'&&accessGrantActive(g)?'<button class="btn small danger" data-revoke-grant="'+g.id+'" type="button">Отозвать доступ</button>':'')+'</div>').join(''):empty('Временных допусков пока нет. Доступ к данным не открыт.');
  $('adminAccessRows').innerHTML=people.map(u=>'<tr><td><strong>'+escapeHtml(u.name)+'</strong><small>'+accessRoleLabel(u)+'</small></td><td>'+escapeHtml(u.projects.map(p=>planningProjects[p]?.code).filter(Boolean).join(', '))+'</td><td>'+escapeHtml(u.role==='leader'?'Все разделы':u.role==='admin'?'Только по действующему инциденту':u.role==='project_manager'?'Явные права по каждому проекту':accessDepartment(u)?.sections.map(s=>accessSections[s]).join(', ')||'Не назначены')+'</td><td>'+escapeHtml(u.role==='project_manager'?accessPMSummary(u):Object.entries(u.sectionAccess??{}).filter(([,v])=>v!=='inherit').map(([s,v])=>(accessSections[s]??s)+': '+(v==='deny'?'закрыто':'только чтение')).join('; ')||'По роли и отделу')+'</td><td>'+(accessCanManageUser(u)?'<button class="btn small" data-user="'+u.id+'" type="button">Допуски</button>':'Защищённая учётная запись')+'</td></tr>').join('');
  renderAccessGovernance();
  renderOrganization();
  $('classificationDepartment').innerHTML=accessOptions(accessState.departments.filter(d=>a.role==='leader'||d.id===a.departmentId),a.departmentId);
  $('classificationForm').hidden=!['leader','head'].includes(a.role);
  $('classificationRows').innerHTML=accessState.classifications.filter(c=>a.role==='leader'||c.departmentId===a.departmentId).map(c=>'<div class="list-row"><h3>'+escapeHtml(c.name)+'</h3><p>'+escapeHtml(accessState.departments.find(d=>d.id===c.departmentId)?.name)+' · '+escapeHtml(c.kind==='entity'?'Сущность справочника':'Классификация')+'</p></div>').join('')||empty('Сущности и классификации отдела ещё не добавлены.');
  $('adminProjectRows').innerHTML=projectIds.map(id=>{const p=planningProjects[id];return '<tr><td><strong>'+escapeHtml(p.code+' · '+p.name)+'</strong><small>'+escapeHtml(p.direction)+'</small></td><td>'+escapeHtml(a.role==='leader'?(p.description??'Описание ещё не заполнено'):'Описание доступно руководителю')+'</td><td>'+(a.role==='leader'?money(p.base):'Не предоставлено')+'</td><td>'+(a.role==='leader'?'<button class="btn small" data-edit-project="'+id+'" type="button">Редактировать</button>':'Только метаданные')+'</td></tr>';}).join('');
  $('adminAuditRows').innerHTML=accessState.events.slice(-60).reverse().map(e=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(e.action)+'</h3><span class="unit">'+escapeHtml(new Date(e.at).toLocaleString('ru-RU'))+'</span></div><p>'+escapeHtml(e.actorName+' → '+e.target)+'</p><p>'+escapeHtml(a.role==='admin'&&e.action.startsWith('Проект')?'Содержание изменения доступно руководителю':e.reason)+'</p>'+(a.role==='leader'&&(e.before||e.after)?'<p class="admin-audit-detail">'+escapeHtml(JSON.stringify(e.before??{}))+' → '+escapeHtml(JSON.stringify(e.after??{}))+'</p>':'')+'</div>').join('')||empty('Изменения доступа будут зафиксированы здесь. Тексты переписок не журналируются.');
}
function openAccessUserForm(id=null){
  const a=accessActor(),u=id?users.find(x=>x.id===id):null,self=u?.id===a?.id;
  if(!accessActive()||(!self&&!accessCanAdmin())||(u&&!self&&!accessCanManageUser(u))){notify('Нет права изменять этого пользователя.');return;}
  editingUser=id;const f=$('userForm');f.reset();const head=['head','project_manager'].includes(a.role),manage=accessCanAdmin()&&(!u||accessCanManageUser(u));
  $('userDialogTitle').textContent=u?'Профиль · '+u.name:'Добавить сотрудника';
  if(globalThis.epsilonAuth){$('changeOwnPassword').hidden=!self;$('userCredentialsHint').hidden=false;$('userCredentialsHint').textContent=u?(u.passwordState??'Пароль хранится на сервере'):'При сохранении сервер выдаст случайный временный пароль на 48 часов. Его необходимо передать пользователю лично.';}
  for(const k of ['name','email','position','timezone','notifications'])f.elements[k].value=u?.[k]??({timezone:'Europe/Vienna',notifications:'assigned'}[k]??'');
  f.elements.position.readOnly=!manage;f.elements.email.readOnly=!manage;f.elements.name.readOnly=!manage&&!self;
  const allowedRoles=a.role==='leader'?Object.keys(accessRoles):a.role==='admin'?['admin','head','project_manager','employee','unassigned']:['employee'];
  f.elements.role.innerHTML=Object.entries(accessRoles).filter(([r])=>allowedRoles.includes(r)||r===u?.role).map(([r,label])=>'<option value="'+r+'">'+label+'</option>').join('');f.elements.role.value=u?.role??(head?'employee':'unassigned');f.elements.role.disabled=!manage||head||self&&a.role==='admin'||u?.role==='leader'&&a.role!=='leader'||u?.id===accessState.superAdminId;
  f.elements.departmentId.innerHTML='<option value="">Не назначен</option>'+accessOptions(accessState.departments.filter(d=>!head||organizationCanEdit(d.id)),u?.departmentId??a.departmentId);f.elements.departmentId.value=u?.departmentId??(head?a.departmentId:'');f.elements.departmentId.disabled=!manage||head;
  $('userProjectChecks').innerHTML=accessProjectChecks('projects',u?.projects??[],head?accessProjects():projectIds,false);
  $('userStatusReadOnly').innerHTML=badge(accessStatusLabel(u??{status:'active'}),(u?.status??'active')==='active'?'good':'risk');
  $('userAccessMatrix').innerHTML=Object.entries(accessSections).map(([s,label])=>'<label class="admin-permission-line"><span>'+label+'</span><select name="section-'+s+'"><option value="inherit"'+(!u?.sectionAccess?.[s]||u?.sectionAccess?.[s]==='inherit'?' selected':'')+'>По роли / отделу</option><option value="read"'+(u?.sectionAccess?.[s]==='read'?' selected':'')+'>Разрешено</option><option value="deny"'+(u?.sectionAccess?.[s]==='deny'?' selected':'')+'>Запрещено</option></select></label>').join('');
  $('userAccessControls').hidden=!manage||head||u?.role==='project_manager'||u?.role==='leader'||self&&a.role==='admin';$('userAccessReason').hidden=!manage;f.elements.accessReason.required=Boolean(manage&&u&&!self);
  $('userRoleHint').textContent=head?'Роль назначает администратор или руководитель. Права руководителя проектов своего отдела настраиваются только в пределах ваших проектов и полномочий.':a.role==='admin'?'Администратор не меняет свою роль, не назначает и не блокирует руководителей. Права руководителя проектов задаёт руководитель или руководитель отдела.':'Суперадмин — уникальное полномочие, не роль в списке. Его нельзя снять сменой роли; сначала необходима согласованная передача. Личные чаты закрыты.';
  renderAccessPMControls();
  $('userFormError').hidden=true;$('userDialog').showModal();f.elements.name.focus();
}
function saveAccessUser(event){
  event.preventDefault();const f=$('userForm');if(!f.reportValidity())return;const a=accessActor(),old=users.find(u=>u.id===editingUser),self=old?.id===a?.id,head=['head','project_manager'].includes(a?.role),manage=accessCanAdmin()&&(!old||accessCanManageUser(old));
  if(!accessActive()||!manage&&!self)return accessFormError('userFormError','Полномочия отозваны. Изменение не сохранено.');
  const name=f.elements.name.value.trim(),email=f.elements.email.value.trim().toLowerCase(),position=f.elements.position.value.trim(),role=manage&&!head?f.elements.role.value:old?.role??'employee',departmentId=role==='unassigned'?'':manage&&!head?f.elements.departmentId.value:old?.departmentId??a.departmentId;
  const canProjects=manage&&(!head||!old||old.role==='project_manager')&&!(self&&a.role==='admin')&&!(old?.role==='leader'&&a.role!=='leader'),requestedProjects=accessChecked(f,'projects');
  let projects=canProjects?requestedProjects:old?.projects??[];
  if(role==='unassigned')projects=[];
  if(head&&old?.role==='project_manager')projects=[...new Set([...old.projects.filter(p=>!accessProjects().includes(p)),...projects])];
  const error=!name||!email?'Укажите имя и email.':manage&&!position?'Укажите должность — она не заменяет роль.':!canProjects&&old&&requestedProjects.slice().sort().join('|')!==[...(old.projects??[])].sort().join('|')?'Изменение проектного допуска в вашем контуре недоступно.':users.some(u=>u.id!==old?.id&&u.email.toLowerCase()===email)?'Такой email уже зарегистрирован.':role!=='unassigned'&&!accessState.departments.some(d=>d.id===departmentId)?'Выберите отдел.':projects.some(p=>!projectIds.includes(p)||head&&!accessProjects().includes(p)&&!old?.projects.includes(p))?'Недопустимый проект.':role!==old?.role&&!(!old&&head&&role==='employee')&&!accessCanChangeRole(old,role)?'Нет права назначать эту роль.':null;
  if(error)return accessFormError('userFormError',error);
  if(manage&&old&&!self&&!f.elements.accessReason.value.trim())return accessFormError('userFormError','Укажите основание изменения профиля и доступа.');
  const sectionAccess=structuredClone(old?.sectionAccess??{});
  if(manage&&!head&&!(self&&a.role==='admin')&&old?.role!=='leader')for(const section of Object.keys(accessSections)){const value=f.elements['section-'+section]?.value??'inherit';if(!['inherit','read','deny'].includes(value))return accessFormError('userFormError','Неверный режим доступа.');sectionAccess[section]=value;}
  const next={...(old??{}),id:old?.id??uid('user'),name,email:manage?email:old.email,position:manage?position:old.position,role,departmentId,projects,status:old?.status??'active',sectionAccess,timezone:f.elements.timezone.value,notifications:f.elements.notifications.value};
  if(role!=='employee'){delete next.membershipAccess;delete next.departmentManaged;}
  if(role==='unassigned'){next.sectionAccess={};delete next.membershipAccess;delete next.departmentManaged;}
  if(head&&!old)organizationSetMembership(next,departmentId,projects,position);
  if(role==='project_manager'){
    const permissions=accessReadPMForm(next,old,f);if(permissions.error)return accessFormError('userFormError',permissions.error);
    next.pmAccess=permissions.pmAccess;next.pmDeadlines=permissions.pmDeadlines;
  }else{delete next.pmAccess;delete next.pmDeadlines;}
  if(old)users[users.indexOf(old)]=next;else users.push(next);
  accessAudit(old?'Профиль и права изменены':'Пользователь добавлен',next.name,f.elements.accessReason.value.trim()||'Настройки пользователя',{before:old?{role:old.role,position:old.position,departmentId:old.departmentId,projects:old.projects,sectionAccess:old.sectionAccess,pmAccess:old.pmAccess,pmDeadlines:old.pmDeadlines}:null,after:{role:next.role,position:next.position,departmentId:next.departmentId,projects:next.projects,sectionAccess:next.sectionAccess,pmAccess:next.pmAccess,pmDeadlines:next.pmDeadlines}});
  persist();$('userDialog').close();render();notify('Профиль сохранён. Роль и должность учитываются отдельно.');
}
function openAccessBlock(id){
  openAccessUserAction(id,'block');
}
function openAccessUserAction(id,action){
  const u=users.find(x=>x.id===id);if(!accessCanUserAction(u,action)){notify('Это действие с пользователем недоступно.');return;}
  const f=$('accessBlockForm');f.reset();f.elements.userId.value=id;f.elements.action.value=action;
  $('accessBlockTitle').textContent=({block:u.status==='blocked'?'Разблокировать: ':'Блокировать: ',revoke:'Отозвать весь доступ: ',restore:'Вернуть доступ: ',delete:'Удалить учётную запись: '}[action])+u.name;
  $('accessBlockNote').textContent=action==='delete'?'Пользователь потеряет доступ и исчезнет из рабочего списка. История, авторство и связанные документы сохранятся; запись останется в архиве аудита. Удаление не отменяет обязательства по задачам.':action==='revoke'?'Все проекты и разделы станут недоступны. Настройки допусков сохраняются для возможного восстановления; действующие временные допуски отзываются без автоматического восстановления.':action==='restore'?'Восстановятся сохранённые проектные и секционные допуски. Старые временные допуски администратора не возобновятся.':'Блокировка действует во всех проектах и разделах. Разблокировка не восстанавливает ранее отозванный доступ или временные допуски.';
  $('accessBlockError').hidden=true;$('accessBlockDialog').showModal();
}
function saveAccessBlock(event){
  event.preventDefault();const f=$('accessBlockForm');if(!f.reportValidity())return;const u=users.find(x=>x.id===f.elements.userId.value),reason=f.elements.reason.value.trim(),action=f.elements.action?.value||'block';
  if(!accessCanUserAction(u,action)||!reason||action==='restore'&&u.status!=='inactive'||action==='revoke'&&u.status!=='active')return accessFormError('accessBlockError','Нет права на операцию, статус изменился или не указано основание.');
  const before=u.status,at=new Date().toISOString();
  if(action==='block'){if(u.status==='blocked'){u.status=u.preBlockStatus==='inactive'?'inactive':'active';}else{u.preBlockStatus=u.status;u.status='blocked';}u.blockedAt=at;}
  if(action==='revoke'){u.status='inactive';u.accessRevokedAt=at;}
  if(action==='restore'){u.status='active';delete u.accessRevokedAt;}
  if(action==='delete'){u.status='deleted';u.deletedAt=at;u.deletedBy=accessActor().id;}
  u.blockReason=reason;
  if(u.status!=='active')accessState.grants.filter(g=>(g.adminId===u.id||g.issuedBy===u.id)&&!g.revokedAt).forEach(g=>{g.revokedAt=at;g.revokeReason='Учётная запись отключена: '+reason;});
  const label=action==='block'?(before==='blocked'?'Разблокировка':'Тотальная блокировка'):{revoke:'Доступ пользователя отозван',restore:'Доступ пользователя восстановлен',delete:'Учётная запись удалена'}[action];
  accessAudit(label,u.name,reason,{userId:u.id,before:{status:before},after:{status:u.status}});persist();$('accessBlockDialog').close();render();notify(action==='delete'?'Учётная запись удалена из рабочего контура. История сохранена.':'Статус учётной записи обновлён во всех проектах.');
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
function openAccessDepartment(){openOrganizationDepartment();}
function saveAccessDepartment(event){saveOrganizationDepartment(event);}
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
  setupOrganization();
  $('demoActor').addEventListener('change',e=>{if(globalThis.epsilonAuth)return;accessState.actorId=e.target.value;document.querySelectorAll('dialog[open]').forEach(d=>d.close());closeDrawer();persist();navigate(accessHome());});
  $('adminUserSearch').addEventListener('input',renderAccessPortal);$('adminAddUser').addEventListener('click',()=>openAccessUserForm());
  $('adminIssueGrant').addEventListener('click',openAccessGrant);$('adminAddDepartment').addEventListener('click',()=>openAccessDepartment());$('adminAddProject').addEventListener('click',()=>openAccessProject());
  for(const [id,fn] of [['accessBlockForm',saveAccessBlock],['incidentForm',saveAccessGrant],['departmentForm',saveAccessDepartment],['classificationForm',saveAccessClassification],['accessProjectForm',saveAccessProject],['transferDecisionForm',saveAccessTransferDecision]])$(id).addEventListener('submit',fn);
  $('userForm').elements.role.addEventListener('change',renderAccessPMControls);
  document.addEventListener('submit',e=>{if(e.target.id==='superTransferForm')saveAccessTransfer(e);});
  document.addEventListener('click',e=>{const action=e.target.closest('[data-user-action]'),decision=e.target.closest('[data-transfer-decision]');if(action)openAccessUserAction(action.dataset.targetUser,action.dataset.userAction);if(decision)openAccessTransferDecision(decision.dataset.transferId,decision.dataset.transferDecision);});
  $('accessRevokeForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target;if(f.reportValidity()&&revokeAccessGrant(f.elements.grantId.value,f.elements.reason.value)){$('accessRevokeDialog').close();render();}else accessFormError('accessRevokeError','Нет права отзыва или срок допуска уже истёк.');});
  document.addEventListener('click',e=>{const tab=e.target.closest('[data-admin-tab]'),block=e.target.closest('[data-block-user]'),revoke=e.target.closest('[data-revoke-grant]'),project=e.target.closest('[data-edit-project]');if(tab){accessTab=tab.dataset.adminTab;renderAccessPortal();}if(block)openAccessBlock(block.dataset.blockUser);if(project)openAccessProject(project.dataset.editProject);if(revoke&&accessActor()?.role==='leader'){const f=$('accessRevokeForm');f.reset();f.elements.grantId.value=revoke.dataset.revokeGrant;$('accessRevokeError').hidden=true;$('accessRevokeDialog').showModal();}});
  window.setInterval(()=>{if(accessActor()?.role==='admin'&&currentRoute in accessSections){if(!accessCanRoute(currentRoute)){document.querySelectorAll('dialog[open]').forEach(d=>d.close());navigate('admin');notify('Временный допуск истёк или отозван.');}else render();}},15000);
  window.addEventListener('storage',event=>{
    if(globalThis.epsilonAuth)return;
    if(event.key!==storageKey||!event.newValue)return;
    try{
      const next=normalizeRubDemoData(JSON.parse(event.newValue));if(next.access?.version!==1||!Array.isArray(next.users))return;
      const actorId=accessState.actorId;restoreProjectCatalog(next);for(const id of Object.keys(planningProjects))if(!projectIds.includes(id))projectIds.push(id);
      if(!next.users.every(validUser))return;
      users=next.users;initializeAccess({...next,access:{...next.access,actorId}});document.querySelectorAll('dialog[open]').forEach(d=>d.close());navigate(accessCanRoute(currentRoute)?currentRoute:accessHome(),{replace:true});
    }catch{/* Ignore malformed demo state; never silently broaden access. */}
  });
}
