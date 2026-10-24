'use strict';

const organizationWaitingMessage='Дождитесь добавления Вашего профиля Руководителем';
let organizationSelected=null,editingAccessDepartment=null;
function accessOnboardingRequired(u=accessActor()){
  if(!accessActive(u))return false;
  if(['leader','admin'].includes(u.role))return false;
  return u.role==='unassigned'||!accessDepartment(u)||!accessProjects(u).length;
}
function organizationCanManage(u=accessActor()){return accessActive(u)&&!accessOnboardingRequired(u)&&['leader','head','project_manager'].includes(u.role);}
function organizationDepartments(u=accessActor()){
  if(!organizationCanManage(u))return [];
  if(u.role==='leader')return accessState.departments.map(d=>d.id);
  const ids=new Set([u.departmentId]);
  for(let n=0;n<accessState.departments.length;n++)for(const d of accessState.departments)if(ids.has(d.parentId))ids.add(d.id);
  return accessState.departments.filter(d=>ids.has(d.id)).map(d=>d.id);
}
function organizationCanEdit(id,u=accessActor()){return organizationDepartments(u).includes(id);}
function organizationProjectScope(id,u=accessActor()){
  const d=accessState.departments.find(d=>d.id===id);return d?.projects.filter(p=>accessProjects(u).includes(p))??[];
}
function organizationCanMove(target,departmentId){
  if(!organizationCanEdit(departmentId)||!target||target.status!=='active'||target.id===accessActor().id||!['unassigned','employee'].includes(target.role))return false;
  return target.role==='unassigned'||accessActor().role==='leader'||organizationCanEdit(target.departmentId)&&target.projects.every(p=>accessProjects().includes(p));
}
function organizationCeiling(departmentId,projects){
  if(accessActor().role==='leader')return undefined;
  const d=accessState.departments.find(d=>d.id===departmentId),rights={};
  for(const p of projects){rights[p]={};for(const section of ['planning',...d.sections])rights[p][section]=accessCan(section,p,'write')?'write':accessCan(section,p)?'read':'none';}
  return rights;
}
function organizationSetMembership(user,departmentId,projects,position){
  user.role='employee';user.departmentId=departmentId;user.projects=[...projects];user.position=position;
  user.departmentManaged=true;user.membershipAccess=organizationCeiling(departmentId,projects);user.sectionAccess={};
  delete user.pmAccess;delete user.pmDeadlines;
}
function organizationSnapshot(user){return {role:user.role,departmentId:user.departmentId,projects:[...user.projects],position:user.position,sectionAccess:structuredClone(user.sectionAccess??{}),membershipAccess:structuredClone(user.membershipAccess??null)};}
function renderOrganization(){
  const allowed=organizationDepartments(),visible=accessState.departments.filter(d=>accessActor().role==='admin'||allowed.includes(d.id));
  if(!visible.some(d=>d.id===organizationSelected))organizationSelected=visible.find(d=>d.id===accessActor().departmentId)?.id??visible[0]?.id;
  $('adminDepartments').innerHTML=visible.map(d=>'<button class="organization-department'+(d.id===organizationSelected?' selected':'')+'" data-organization-department="'+d.id+'" type="button"><span>'+escapeHtml(d.name)+'</span><small>'+escapeHtml(d.parentId?'Подотдел · '+(accessState.departments.find(p=>p.id===d.parentId)?.name??'—'):'Отдел')+'</small></button>').join('')||empty('Доступных отделов нет.');
  const d=visible.find(d=>d.id===organizationSelected),members=users.filter(u=>u.status!=='deleted'&&u.departmentId===d?.id);
  $('organizationDetail').innerHTML=d?'<div class="panel-head organization-detail-head"><div><span class="eyebrow">СОСТАВ / ДОПУСКИ / ОТВЕТСТВЕННОСТЬ</span><h2>'+escapeHtml(d.name)+'</h2></div>'+(organizationCanEdit(d.id)?'<button class="btn small" data-rename-department="'+d.id+'" type="button">Переименовать</button>':'')+'</div><div class="organization-context"><p>Проекты: '+escapeHtml(d.projects.map(p=>planningProjects[p]?.code).join(' · ')||'Не назначены')+'</p><p>Рабочие разделы: '+escapeHtml(d.sections.map(s=>accessSections[s]).join(', ')||'Только планирование при наличии допуска к проекту')+'</p>'+(organizationCanEdit(d.id)?'<div class="admin-row-actions"><button class="btn primary" data-organization-new="'+d.id+'" type="button">+ Новый сотрудник</button><button class="btn" data-organization-assign="'+d.id+'" type="button">Назначить из списка</button></div>':'')+'</div><div class="table-wrap"><table><thead><tr><th>Сотрудник / должность</th><th>Роль</th><th>Допуск</th><th>Управление</th></tr></thead><tbody>'+members.map(u=>'<tr><td><strong>'+escapeHtml(u.name)+'</strong><small>'+escapeHtml(u.position)+'</small></td><td>'+badge(accessRoleLabel(u))+'</td><td>'+badge(accessOnboardingRequired(u)?'Ожидает допуска':accessStatusLabel(u),u.status==='active'&&!accessOnboardingRequired(u)?'good':'warning')+'<small>'+escapeHtml(accessProjects(u).map(p=>planningProjects[p]?.code).join(' · ')||'Нет доступных проектов')+'</small></td><td>'+(organizationCanMove(u,d.id)?'<div class="admin-row-actions"><button class="btn small" data-organization-member="'+u.id+'" type="button">Изменить состав</button><button class="btn small danger" data-organization-remove="'+u.id+'" type="button">Исключить из отдела</button></div>':'Защищённая роль / вне контура')+'</td></tr>').join('')+'</tbody></table></div>'+(members.length?'':empty('В отделе пока нет сотрудников.')):empty('Выберите отдел.');
  const pending=users.filter(u=>u.status==='active'&&u.role==='unassigned');
  $('organizationPending').innerHTML=pending.length?pending.map(u=>'<div class="list-row"><div class="list-row-top"><div><h3>'+escapeHtml(u.name)+'</h3><p>'+escapeHtml(u.email)+'</p></div>'+badge('Роль не назначена','warning')+'</div><p class="form-note">Содержимое системы закрыто до назначения отдела и допуска.</p>'+(d&&organizationCanMove(u,d.id)?'<button class="btn small" data-organization-pending="'+u.id+'" type="button">Назначить в выбранный отдел</button>':'')+'</div>').join(''):empty('Нет пользователей, ожидающих назначения.');
}
function openOrganizationDepartment(id=null){
  if(!organizationCanManage()||id&&!organizationCanEdit(id)){notify('Нет права изменять этот отдел.');return;}
  editingAccessDepartment=id;const d=accessState.departments.find(d=>d.id===id),f=$('departmentForm'),ids=accessActor().role==='leader'?projectIds:[...new Set([...accessProjects(),...(d?.projects??[])])];f.reset();
  $('departmentTitle').textContent=d?'Настройки отдела':'Новый отдел';f.elements.name.value=d?.name??'';
  const parent=d?d.parentId??'':accessActor().role==='leader'?'':accessActor().departmentId;
  $('departmentParent').innerHTML='<option value="">Корневой отдел</option>'+accessOptions(accessState.departments.filter(x=>organizationCanEdit(x.id)),parent);
  f.elements.parentId.value=parent;f.elements.parentId.disabled=Boolean(d);
  if(accessActor().role!=='leader')$('departmentParent').querySelector('option[value=""]').disabled=true;
  $('departmentProjects').innerHTML=accessProjectChecks('projects',d?.projects??[],ids,false);
  $('departmentSections').innerHTML=Object.entries(accessSections).filter(([s])=>!['dashboard','planning','budget','reports'].includes(s)&&(d||accessActor().role==='leader'||accessProjects().some(p=>accessCan(s,p)))).map(([s,label])=>'<label><input type="checkbox" name="sections" value="'+s+'"'+(d?.sections.includes(s)?' checked':'')+' />'+escapeHtml(label)+'</label>').join('');
  $('departmentScopeNote').textContent=d?'Состав, проекты и рабочие разделы можно корректировать. Доступы сотрудников пересчитываются по действующей политике; права нельзя расширить за полномочия руководителя.':'Принадлежность к отделу определяет рабочие разделы. Персональные проекты и предел прав назначаются при включении сотрудника в состав.';
  $('departmentSave').textContent=d?'Сохранить настройки':'Создать отдел';$('departmentError').hidden=true;$('departmentDialog').showModal();
}
function saveOrganizationDepartment(event){
  event.preventDefault();const f=$('departmentForm');if(!f.reportValidity())return;
  const old=accessState.departments.find(d=>d.id===editingAccessDepartment),name=f.elements.name.value.trim(),reason=f.elements.reason.value.trim(),parentId=old?.parentId??f.elements.parentId.value??'',projects=accessChecked(f,'projects'),sections=accessChecked(f,'sections'),leader=accessActor().role==='leader';
  const error=!organizationCanManage()||editingAccessDepartment&&!old||old&&!organizationCanEdit(old.id)?'Нет права изменять отдел.':!name||name.length>100||!reason?'Укажите название и основание.':accessState.departments.some(d=>d.id!==old?.id&&d.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'))?'Отдел с таким названием уже существует.':!old&&parentId&&!organizationCanEdit(parentId)?'Нет права создавать подотдел в выбранном контуре.':!old&&!leader&&!parentId?'Выберите родительский отдел в своём контуре.':projects.some(p=>!projectIds.includes(p)||!leader&&!accessProjects().includes(p)&&!old?.projects.includes(p))?'Проект вне вашего допуска.':sections.some(s=>!Object.hasOwn(accessSections,s)||['dashboard','planning','budget','reports'].includes(s)||!leader&&projects.some(p=>(!old?.projects.includes(p)||!old?.sections.includes(s))&&!accessCan(s,p)))?'Нельзя добавить раздел вне своих полномочий.':null;
  if(error)return accessFormError('departmentError',error);
  if(old){const before={name:old.name,projects:[...old.projects],sections:[...old.sections]};Object.assign(old,{name,projects,sections});accessAudit('Настройки отдела изменены',name,reason,{before,after:{id:old.id,name,projects,sections}});}
  else{const d={id:uid('dept'),name,parentId:parentId||null,projects,sections,createdBy:accessActor().id};accessState.departments.push(d);organizationSelected=d.id;accessAudit('Отдел создан',name,reason,{after:structuredClone(d)});}
  persist();$('departmentDialog').close();render();
}
function openOrganizationMember(departmentId,userId=null,mode='assign'){
  if(!organizationCanEdit(departmentId))return;
  const d=accessState.departments.find(d=>d.id===departmentId),user=users.find(u=>u.id===userId),f=$('organizationMemberForm');f.reset();
  f.elements.mode.value=mode;f.elements.departmentId.innerHTML=accessOptions(accessState.departments.filter(d=>organizationCanEdit(d.id)),departmentId);f.elements.departmentId.value=departmentId;
  const candidates=users.filter(u=>organizationCanMove(u,departmentId));f.elements.userId.innerHTML=accessOptions(candidates.map(u=>({id:u.id,name:u.name+' · '+(u.role==='unassigned'?'Роль не назначена':accessDepartment(u)?.name??'—')})),userId);if(userId)f.elements.userId.value=userId;
  const selected=user??(mode==='assign'?candidates[0]:null);
  $('organizationMemberTitle').textContent=mode==='new'?'Новый сотрудник отдела':mode==='remove'?'Исключить сотрудника из отдела':'Назначить сотрудника в отдел';
  $('organizationIdentity').hidden=mode!=='new';$('organizationExisting').hidden=mode==='new';f.elements.userId.disabled=mode==='new'||mode==='remove';f.elements.departmentId.disabled=mode==='remove';
  for(const key of ['name','email']){f.elements[key].required=mode==='new';f.elements[key].value='';}
  f.elements.position.value=selected?.position??'';f.elements.position.required=mode!=='remove';f.elements.position.readOnly=mode==='remove';
  $('organizationMemberProjects').innerHTML=accessProjectChecks('projects',selected?.role==='employee'?selected.projects.filter(p=>organizationProjectScope(departmentId).includes(p)):organizationProjectScope(departmentId),organizationProjectScope(departmentId),mode==='remove');
  $('organizationMembershipProjects').hidden=mode==='remove';
  $('organizationMemberNote').textContent=mode==='new'?'Будет создана роль «Сотрудник» и выдан временный пароль на 48 часов. Передайте его лично. Личный пароль существующего пользователя не меняется.':mode==='remove'?'Роль и отдел будут сняты, допуски закрыты. Учётная запись, личный пароль и история сохранятся; пользователь увидит экран ожидания.':'Назначается только базовая роль «Сотрудник». Сохраняется действующий пароль. Права ограничены проектами отдела и полномочиями назначающего.';
  if(mode!=='remove')$('organizationMemberNote').textContent+=' Если не выбрать ни одного проекта, пользователь останется на экране ожидания допуска.';
  $('organizationMemberError').hidden=true;$('organizationMemberDialog').showModal();
}
function saveOrganizationMember(event){
  event.preventDefault();const f=$('organizationMemberForm');if(!f.reportValidity())return;
  const mode=f.elements.mode.value,departmentId=f.elements.departmentId.value,target=users.find(u=>u.id===f.elements.userId.value),reason=f.elements.reason.value.trim(),projects=accessChecked(f,'projects'),position=f.elements.position.value.trim();
  if(!['new','assign','remove'].includes(mode)||!reason||!organizationCanEdit(departmentId)||mode!=='new'&&!organizationCanMove(target,departmentId))return accessFormError('organizationMemberError','Нет полномочий, пользователь изменился или не указано основание.');
  if(mode==='remove'){
    if(target.departmentId!==departmentId)return accessFormError('organizationMemberError','Сотрудник уже переведён в другой отдел.');
    const before=organizationSnapshot(target);target.role='unassigned';target.departmentId='';target.projects=[];target.sectionAccess={};delete target.membershipAccess;delete target.departmentManaged;
    accessAudit('Сотрудник исключён из отдела',target.name,reason,{userId:target.id,before,after:organizationSnapshot(target)});
  }else{
    if(!position||position.length>120||projects.some(p=>!organizationProjectScope(departmentId).includes(p)))return accessFormError('organizationMemberError','Укажите должность и проекты в пределах отдела и своего допуска.');
    let user=target;
    if(mode==='new'){
      const name=f.elements.name.value.trim(),email=f.elements.email.value.trim().toLowerCase();
      if(!name||name.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>120||users.some(u=>u.email.toLowerCase()===email))return accessFormError('organizationMemberError','Проверьте имя и уникальный рабочий email.');
      user={id:uid('user'),name,email,status:'active',timezone:'Europe/Moscow',notifications:'assigned'};
    }
    const before=target?organizationSnapshot(target):null;organizationSetMembership(user,departmentId,projects,position);if(mode==='new')users.push(user);
    accessAudit(mode==='new'?'Сотрудник отдела создан':'Состав отдела изменён',user.name,reason,{userId:user.id,before,after:organizationSnapshot(user)});
  }
  persist();$('organizationMemberDialog').close();render();notify('Структура и состав отдела сохранены.');
}
function setupOrganization(){
  $('organizationMemberForm').addEventListener('submit',saveOrganizationMember);
  $('organizationMemberForm').elements.departmentId.addEventListener('change',()=>{const f=$('organizationMemberForm');$('organizationMemberProjects').innerHTML=accessProjectChecks('projects',organizationProjectScope(f.elements.departmentId.value),organizationProjectScope(f.elements.departmentId.value));});
  $('organizationMemberForm').elements.userId.addEventListener('change',()=>{const f=$('organizationMemberForm'),u=users.find(u=>u.id===f.elements.userId.value);f.elements.position.value=u?.position??'';});
  document.addEventListener('click',e=>{
    const select=e.target.closest('[data-organization-department]'),rename=e.target.closest('[data-rename-department]'),fresh=e.target.closest('[data-organization-new]'),assign=e.target.closest('[data-organization-assign]'),member=e.target.closest('[data-organization-member]'),remove=e.target.closest('[data-organization-remove]'),pending=e.target.closest('[data-organization-pending]');
    if(select){organizationSelected=select.dataset.organizationDepartment;renderOrganization();}if(rename)openOrganizationDepartment(rename.dataset.renameDepartment);if(fresh)openOrganizationMember(fresh.dataset.organizationNew,null,'new');if(assign)openOrganizationMember(assign.dataset.organizationAssign);if(member){const u=users.find(u=>u.id===member.dataset.organizationMember);openOrganizationMember(u.departmentId,u.id);}if(remove){const u=users.find(u=>u.id===remove.dataset.organizationRemove);openOrganizationMember(u.departmentId,u.id,'remove');}if(pending)openOrganizationMember(organizationSelected,pending.dataset.organizationPending);
  });
}
