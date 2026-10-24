import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const elements=new Map();let stored=null;
const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,innerHTML:'',textContent:'',close(){},focus(){}});return elements.get(id);};
const ctx=vm.createContext({structuredClone,console,URL,Blob,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>stored,setItem:(_k,v)=>{stored=v;}},document:{getElementById:get,body:{append(){}},createElement:()=>({click(){},remove(){}})}});
const source=file=>readFileSync(new URL('../dist/assets/'+file,import.meta.url),'utf8');
for(const file of ['seed.js','technology.js','production.js','organization.js','access.js'])vm.runInContext(source(file),ctx,{filename:file});
vm.runInContext(source('app.js').split("document.addEventListener('click',event=>")[0],ctx);
const run=code=>vm.runInContext(code,ctx);run('render=()=>{};notify=()=>{};renderAccessPortal=()=>{};');ctx.event={preventDefault(){}};
function form(id,values,checked={}){
  elements.set(id,{reportValidity:()=>true,elements:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:String(v),focus(){}}])),querySelectorAll:selector=>(checked[selector.match(/name="([^\"]+)"/)?.[1]]??[]).map(value=>({value}))});
}
const actor=id=>run(`accessState.actorId=${JSON.stringify(id)};`);
const check=code=>run(code);
assert.deepEqual([...run('Object.keys(roles)')],['admin','leader','head','project_manager','employee','unassigned']);
assert.equal(check("users.find(u=>u.id==='team-3').position"),'Специалист по закупкам');
assert.equal(check("users.find(u=>u.id==='team-3').role"),'employee');
// Administrative authority is not authority to read business data or chats.
actor('admin');assert.equal(check('accessCanAdmin()'),true);
for(const section of Object.keys(run('accessSections')))assert.equal(check(`accessCan('${section}','aurora')`),false,section);
assert.equal(check("accessCanChangeRole(accessActor(),'leader')"),false);
assert.equal(check("accessCanChangeRole(users.find(u=>u.id==='team-0'),'leader')"),false);
assert.equal(check("accessCanChangeRole(users.find(u=>u.id==='team-0'),'head')"),true);
assert.equal(check("accessCanChangeRole(users.find(u=>u.id==='director'),'employee')"),false);
assert.equal(check("accessCanReadConversation({type:'group',participants:['admin']})"),false);
assert.equal(check("accessCanReadConversation({type:'direct',participants:['admin','team-0']})"),false);
assert.throws(()=>run('snapshot()'),/руководителю/);
assert.equal(run('accessSafeSnapshot().totals'),undefined);
// Director: all project information, but not other employees' 1:1 conversations.
actor('director');for(const section of Object.keys(run('accessSections')))assert.equal(check(`accessCan('${section}','aurora','verify')`),true,section);
assert.equal(check("accessCanReadConversation({type:'direct',participants:['team-0','team-1']})"),false);
assert.equal(check("accessCanReadConversation({type:'direct',participants:['director','team-0']})"),true);
assert.equal(check("accessCanReadConversation({type:'group',participants:['team-0']})"),true);
// Head: own department, own projects, and no role changes.
actor('head-production');assert.equal(check("accessCan('production','aurora','verify')"),true);
assert.equal(check("accessCan('production','orbit','verify')"),false);
assert.equal(check("accessCan('quality','aurora')"),false);
assert.equal(check("accessCanChangeRole(users.find(u=>u.id==='employee-production'),'head')"),false);
assert.equal(check("accessCanManageUser(users.find(u=>u.id==='team-0'))"),false);
assert.equal(check("accessCanManageUser(users.find(u=>u.id==='employee-production'))"),true);
assert.equal(check("accessCanEditTask(tasks.find(t=>t.project==='aurora'))"),false,'Department role does not override task ownership; only its creator or delegated editors may edit');
// Employee: no aggregate analytics, no admin, no cross-project or cross-department write.
actor('employee-production');assert.equal(check('accessCanAdmin()'),false);
assert.equal(check("accessCan('production','aurora','write')"),true);assert.equal(check("accessCan('production','aurora','verify')"),false);
for(const section of ['dashboard','budget','reports','technology','quality'])assert.equal(check(`accessCan('${section}','aurora')`),false);
run("accessActor().sectionAccess.quality='read';");assert.equal(check("accessCan('quality','aurora')"),true);assert.equal(check("accessCan('quality','aurora','write')"),false);
run("accessActor().sectionAccess.production='deny';");assert.equal(check("accessCan('production','aurora')"),false);run("delete accessActor().sectionAccess.production;");
// Role/position separation: department heads cannot forge role, department or project.
actor('head-production');
const fields={name:'Тестовый сотрудник',email:'access-test@epsilon.example',position:'Мастер участка',role:'leader',departmentId:'quality',status:'active',timezone:'Europe/Vienna',notifications:'assigned',accessReason:'Приём в отдел'};
form('userForm',fields,{projects:['aurora']});run('editingUser=null;saveAccessUser(event);');
const created=run("users.find(u=>u.email==='access-test@epsilon.example')");assert.equal(created.role,'employee');assert.equal(created.departmentId,'production');assert.equal(created.position,'Мастер участка');
const count=run('users.length');form('userForm',{...fields,email:'forged@epsilon.example'},{projects:['orbit']});run('saveAccessUser(event);');assert.equal(run('users.length'),count);
// An employee cannot self-promote via their personal profile.
actor(created.id);form('userForm',{...fields,role:'leader',name:'Личный профиль',email:created.email},{projects:['orbit']});run(`editingUser=${JSON.stringify(created.id)};saveAccessUser(event);`);
assert.equal(run('accessActor().role'),'employee');assert.deepEqual([...run('accessActor().projects')],['aurora']);
// A grant requires a director; the admin cannot create one, export or mutate through it.
const grantFields={adminId:'admin',hours:1,incident:'INC-TEST',reason:'Проверка инцидента'};
actor('admin');form('incidentForm',grantFields,{projects:['aurora'],sections:['production']});run('saveAccessGrant(event);');assert.equal(run('accessState.grants.length'),0);
actor('director');run('saveAccessGrant(event);');assert.equal(run('accessState.grants.length'),1);
actor('admin');assert.equal(run("accessCan('production','aurora')"),true);assert.equal(run("accessCan('production','orbit')"),false);assert.equal(run("accessCan('production','aurora','write')"),false);
assert.equal(run("accessCanReadConversation({type:'direct',participants:['admin','team-0']})"),false);
assert.equal(run('accessGrantActive(accessState.grants[0],Date.parse(accessState.grants[0].expiresAt)+1)'),false);
assert.equal(run("revokeAccessGrant(accessState.grants[0].id,'Самостоятельный отзыв')"),false);
actor('director');assert.equal(run("revokeAccessGrant(accessState.grants[0].id,'Инцидент разобран')"),true);actor('admin');assert.equal(run("accessCan('production','aurora')"),false);
actor('director');form('incidentForm',grantFields,{projects:['aurora'],sections:['chats']});run('saveAccessGrant(event);');assert.equal(run('accessState.grants.length'),1);
// Total blocking overrides all roles and grants; self/last-director blocking is rejected.
actor('admin');form('accessBlockForm',{userId:'admin',reason:'Самоблокировка'});run('saveAccessBlock(event);');assert.equal(run('accessActor().status'),'active');
form('accessBlockForm',{userId:'director',reason:'Попытка блокировки последнего руководителя'});run('saveAccessBlock(event);');assert.equal(run("users.find(u=>u.id==='director').status"),'active');
form('accessBlockForm',{userId:created.id,reason:'Инцидент учётной записи'});run('saveAccessBlock(event);');actor(created.id);assert.equal(run('accessActive()'),false);assert.equal(run("accessCan('planning','aurora')"),false);assert.equal(run('accessProjects().length'),0);
actor('admin');run('saveAccessBlock(event);');assert.equal(run(`users.find(u=>u.id===${JSON.stringify(created.id)}).status`),'active');
// Only director creates projects and budgets; totals/forecasts aren't silently rewritten.
const projectFields={code:'TEST-01',name:'Новый проект',direction:'Тестовая разработка',description:'Описание проекта',base:2500000,finish:'2026-12-31',reason:'Решение о запуске'};
actor('head-production');form('accessProjectForm',projectFields);run('saveAccessProject(event);');assert.equal(run('projectIds.length'),3);
actor('director');run('saveAccessProject(event);');assert.equal(run('projectIds.length'),4);const projectId=run("projectIds.find(id=>planningProjects[id].code==='TEST-01')");
assert.equal(run(`planningProjects[${JSON.stringify(projectId)}].base`),2500);assert.equal(run(`planningProjects[${JSON.stringify(projectId)}].actual`),0);assert.equal(run(`planningProjects[${JSON.stringify(projectId)}].eac`),0);
actor('admin');assert.equal(run(`accessCan('production',${JSON.stringify(projectId)})`),false);
actor('director');form('departmentForm',{name:'Новый отдел',parentId:'',reason:'Запуск нового направления'},{projects:[projectId],sections:['technology']});run('saveAccessDepartment(event);');assert.ok(run("accessState.departments.some(d=>d.name==='Новый отдел')"));
actor('head-production');form('classificationForm',{departmentId:'quality',name:'Чужой справочник',kind:'entity'});run('saveAccessClassification(event);');assert.equal(run('accessState.classifications.length'),0);
form('classificationForm',{departmentId:'production',name:'Тип сборочного дефекта',kind:'classification'});run('saveAccessClassification(event);');assert.equal(run('accessState.classifications.length'),1);
// Save-time gates are rechecked even when a dialog was opened under an older role.
actor('admin');const before=run('techComponents[0].revision');form('componentForm',{});run("editingComponent=techComponents[0].id;saveComponent(event);");assert.equal(run('techComponents[0].revision'),before);
const beforeRunCount=run('productionData.runs.length');form('productionRunForm',{project:'aurora'});run('saveProductionRun(event);');assert.equal(run('productionData.runs.length'),beforeRunCount);
// Heads may change any admitted deadline, but that does not grant general edit rights.
actor('head-production');const taskId=run("tasks.find(t=>t.project==='aurora'&&!t.techRequestId).id");
assert.equal(check("accessCanSetDeadline('aurora')"),true);assert.equal(check(`accessCanEditTask(tasks.find(t=>t.id===${JSON.stringify(taskId)}))`),false);
// A task assigned to someone outside the project is rejected; assignment never grants access.
const beforeUnadmittedAssignment=run('tasks.length');form('taskForm',{title:'Согласование со смежным отделом',project:'aurora',ownerId:'team-5',kind:'task',parentId:'',startDate:'',due:'2026-11-01',taskType:'one_off',cadence:'weekly',activateDaysBefore:3,description:'Нужен допуск к проекту'});run('editingTask=null;saveTask(event);');
assert.equal(run('tasks.length'),beforeUnadmittedAssignment);assert.equal(run("users.find(u=>u.id==='team-5').projects.includes('aurora')"),false);
actor('employee-production');form('taskForm',{title:'Проверить сборочную операцию',project:'aurora',ownerId:'employee-production',kind:'task',parentId:'',startDate:'',due:'2026-10-30',taskType:'one_off',cadence:'weekly',activateDaysBefore:3,description:'Рабочая задача'});run('editingTask=null;saveTask(event);');
const ownTaskId=run('tasks.at(-1).id');assert.equal(run('tasks.at(-1).plan'),0);
form('taskForm',{title:'Проверить сборочную операцию',project:'aurora',ownerId:'employee-production',kind:'task',parentId:'',startDate:'',due:'2030-12-31',taskType:'one_off',cadence:'weekly',activateDaysBefore:3,description:'Скорректированный срок'});run(`editingTask=${JSON.stringify(ownTaskId)};saveTask(event);`);assert.equal(run(`tasks.find(t=>t.id===${JSON.stringify(ownTaskId)}).due`),'2030-12-31');
// Non-director exports are rejected before any blob or hidden snapshot is exposed.
ctx.URL={createObjectURL:()=>{throw new Error('Forbidden export attempted');},revokeObjectURL(){}};
actor('admin');run("downloadReport({},'json','forbidden');downloadProductionReport({},'json','forbidden');");
// Existing business ledgers survive access administration and its migration.
run('persist();');const data=JSON.parse(stored);assert.equal(data.technology.components.length,16);assert.equal(data.production.runs.length,12);assert.ok(data.access.events.length>=7);assert.ok(data.projectCatalog[projectId]);
const userCount=data.users.length;run('initializeAccess(JSON.parse(localStorage.getItem(storageKey)));');assert.equal(run('users.length'),userCount);
assert.equal(run("users.find(u=>u.email==='access-test@epsilon.example').position"),'Мастер участка');
// Governance migration appoints exactly the first director and never re-elects on reload.
assert.equal(run('accessState.superAdminId'),'director');
assert.equal(run('accessState.governanceVersion'),1);
const user=id=>`users.find(u=>u.id===${JSON.stringify(id)})`;
actor('admin');
for(const id of ['director','leader-operations','leader-strategy']){
  assert.equal(run(`accessCanUserAction(${user(id)},'block')`),false);
  assert.equal(run(`accessCanManageUser(${user(id)})`),false);
  form('accessBlockForm',{userId:id,reason:'Попытка блокировки одного из нескольких руководителей',action:'block'});run('saveAccessBlock(event);');assert.equal(run(`${user(id)}.status`),'active');
}
actor('leader-operations');
for(const id of ['director','leader-strategy','admin'])for(const action of ['block','revoke','restore','delete'])assert.equal(run(`accessCanUserAction(${user(id)},'${action}')`),false);
assert.equal(run(`accessCanChangeRole(${user('admin')},'employee')`),false);
assert.equal(run(`accessCanChangeRole(${user('leader-strategy')},'employee')`),false);
assert.equal(run(`accessCanUserAction(${user('employee-production')},'block')`),true);
// Revoke, restore and blocking are separate transitions; unblocking cannot revive revoked access.
form('accessBlockForm',{userId:created.id,action:'revoke',reason:'Снятие допуска по проектам'});run('saveAccessBlock(event);');actor(created.id);assert.equal(run('accessCanAdmin()'),false);assert.equal(run('accessProjects().length'),0);
actor('leader-operations');form('accessBlockForm',{userId:created.id,action:'block',reason:'Блокировка отозванной записи'});run('saveAccessBlock(event);');assert.equal(run(`${user(created.id)}.status`),'blocked');run('saveAccessBlock(event);');assert.equal(run(`${user(created.id)}.status`),'inactive');
form('accessBlockForm',{userId:created.id,action:'restore',reason:'Восстановление по решению руководителя'});run('saveAccessBlock(event);');assert.equal(run(`${user(created.id)}.status`),'active');
// Only the current superadmin removes accounts; links/history remain and the holder cannot remove/demote self.
form('accessBlockForm',{userId:created.id,action:'delete',reason:'Недопустимое удаление'});run('saveAccessBlock(event);');assert.equal(run(`${user(created.id)}.status`),'active');
actor('director');assert.equal(run('accessSuper()'),true);assert.equal(run("accessCanChangeRole(accessActor(),'employee')"),false);assert.equal(run("accessCanUserAction(accessActor(),'delete')"),false);
for(const id of ['admin','leader-operations','employee-production'])assert.equal(run(`accessCanUserAction(${user(id)},'delete')`),true);
form('accessBlockForm',{userId:created.id,action:'delete',reason:'Удаление тестовой учётной записи'});run('saveAccessBlock(event);');assert.equal(run(`${user(created.id)}.status`),'deleted');assert.equal(run(`validUser(${user(created.id)})`),true);actor(created.id);assert.equal(run('accessActive()'),false);
// Project manager permissions are explicit per project, not inherited from the department.
actor('project-manager');assert.equal(run("accessCan('planning','aurora','write')"),true);assert.equal(run("accessCan('technology','aurora')"),true);assert.equal(run("accessCan('technology','aurora','write')"),false);assert.equal(run("accessCan('planning','orbit')"),false);assert.equal(run("accessCan('dashboard','aurora')"),false);assert.equal(run('accessCanAdmin()'),true);assert.equal(run("accessCanSetDeadline('aurora')"),true);
run('accessActor().pmDeadlines=[];');assert.equal(run("accessCanSetDeadline('aurora')"),false);
// Department heads configure only their own managers, only inside their own authority.
actor('head-production');assert.equal(run(`accessCanManageUser(${user('project-manager')})`),false);
run("users.find(u=>u.id==='project-manager').departmentId='production';");assert.equal(run(`accessCanManageUser(${user('project-manager')})`),true);
const pmFields={...fields,name:'Дмитрий Лебедев',email:'projects@epsilon.example',position:'Руководитель пилотной сборки',role:'project_manager',departmentId:'production','pm-aurora-production':'verify','pm-aurora-planning':'write',accessReason:'Делегирование приёмки сборки'};
form('userForm',pmFields,{projects:['aurora'],'pm-deadlines':['aurora']});run("editingUser='project-manager';saveAccessUser(event);");actor('project-manager');assert.equal(run("accessCan('production','aurora','verify')"),true);assert.equal(run("accessCanSetDeadline('aurora')"),true);
actor('head-production');form('userForm',{...pmFields,'pm-aurora-budget':'write'},{projects:['aurora'],'pm-deadlines':['aurora']});run('saveAccessUser(event);');actor('project-manager');assert.equal(run("accessCan('budget','aurora','write')"),false);
actor('head-quality');assert.equal(run(`accessCanConfigurePM(${user('project-manager')})`),false);
// Admin can assign the role but cannot forge its business permissions.
actor('admin');form('userForm',{...pmFields,'pm-aurora-budget':'verify'},{projects:['aurora'],'pm-deadlines':['aurora']});run('saveAccessUser(event);');actor('project-manager');assert.equal(run("accessCan('budget','aurora')"),false);
// A leader can delegate cross-department data deliberately, without opening other projects.
actor('director');form('userForm',{...pmFields,'pm-aurora-budget':'read'},{projects:['aurora'],'pm-deadlines':['aurora']});run('saveAccessUser(event);');actor('project-manager');assert.equal(run("accessCan('budget','aurora')"),true);assert.equal(run("accessCan('budget','aurora','write')"),false);assert.equal(run("accessCan('budget','orbit')"),false);
// Transfer requires three different active leaders; neither sender nor recipient confirms it.
actor('director');const transferFields={toId:'leader-operations',approverId:'leader-strategy',reason:'Плановая передача управления'};
form('superTransferForm',{...transferFields,approverId:'leader-operations'});run('saveAccessTransfer(event);');assert.equal(run('accessState.transfers.length'),0);
form('superTransferForm',{...transferFields,toId:'admin'});run('saveAccessTransfer(event);');assert.equal(run('accessState.transfers.length'),0);
form('superTransferForm',transferFields);run('saveAccessTransfer(event);');assert.equal(run('accessState.transfers.length'),1);assert.equal(run('accessState.superAdminId'),'director');
run('saveAccessTransfer(event);');assert.equal(run('accessState.transfers.length'),1);
const transferId=run('accessState.transfers[0].id');const decisionFields={transferId,decision:'approve',reason:'Независимое подтверждение'};
for(const id of ['director','leader-operations','admin','project-manager']){actor(id);form('transferDecisionForm',decisionFields);run('saveAccessTransferDecision(event);');assert.equal(run('accessState.superAdminId'),'director');}
// A changed recipient invalidates the pending request at save time.
actor('leader-strategy');run("users.find(u=>u.id==='leader-operations').status='blocked';");form('transferDecisionForm',decisionFields);run('saveAccessTransferDecision(event);');assert.equal(run('accessState.superAdminId'),'director');run("users.find(u=>u.id==='leader-operations').status='active';");
run('saveAccessTransferDecision(event);');assert.equal(run('accessState.superAdminId'),'leader-operations');assert.equal(run('accessState.transfers[0].status'),'approved');assert.equal(run('accessState.transfers[0].decidedBy'),'leader-strategy');run('saveAccessTransferDecision(event);');assert.equal(run('accessState.superAdminId'),'leader-operations');
actor('director');assert.equal(run('accessSuper()'),false);assert.equal(run(`accessCanUserAction(${user('admin')},'delete')`),false);
actor('leader-operations');assert.equal(run('accessSuper()'),true);assert.equal(run(`accessCanUserAction(${user('director')},'delete')`),true);assert.equal(run("accessCanReadConversation({type:'direct',participants:['team-0','team-1']})"),false);
run('persist();initializeAccess(JSON.parse(localStorage.getItem(storageKey)));');assert.equal(run('accessState.superAdminId'),'leader-operations');assert.equal(run('users.length'),userCount);assert.equal(run(`${user(created.id)}.status`),'deleted');
// Cancellation and rejection never move powers.
form('superTransferForm',{toId:'director',approverId:'leader-strategy',reason:'Тест отмены'});run('saveAccessTransfer(event);');let nextTransfer=run('accessState.transfers.at(-1).id');form('transferDecisionForm',{transferId:nextTransfer,decision:'cancel',reason:'Отмена владельцем'});run('saveAccessTransferDecision(event);');assert.equal(run('accessState.transfers.at(-1).status'),'cancelled');
form('superTransferForm',{toId:'director',approverId:'leader-strategy',reason:'Тест отклонения'});run('saveAccessTransfer(event);');nextTransfer=run('accessState.transfers.at(-1).id');actor('leader-strategy');form('transferDecisionForm',{transferId:nextTransfer,decision:'reject',reason:'Требуются дополнительные основания'});run('saveAccessTransferDecision(event);');assert.equal(run('accessState.transfers.at(-1).status'),'rejected');assert.equal(run('accessState.superAdminId'),'leader-operations');
console.log('Tests passed: five roles + unique superadmin, migration, role/position separation, scoped delegation, protected leaders/admins, revoke/restore/soft deletion, three-party transfer/invalidations/replay/cancel/reject, chat privacy, grants and business workflow regressions.');
