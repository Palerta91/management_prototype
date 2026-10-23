import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const elements=new Map();let stored=null;
const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,innerHTML:'',textContent:'',close(){},focus(){}});return elements.get(id);};
const ctx=vm.createContext({structuredClone,console,URL,Blob,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>stored,setItem:(_k,v)=>{stored=v;}},document:{getElementById:get,body:{append(){}},createElement:()=>({click(){},remove(){}})}});
const source=file=>readFileSync(new URL('../dist/assets/'+file,import.meta.url),'utf8');
for(const file of ['seed.js','technology.js','production.js','access.js'])vm.runInContext(source(file),ctx,{filename:file});
vm.runInContext(source('app.js').split("document.addEventListener('click',event=>")[0],ctx);
const run=code=>vm.runInContext(code,ctx);run('render=()=>{};notify=()=>{};renderAccessPortal=()=>{};');ctx.event={preventDefault(){}};
function form(id,values,checked={}){
  elements.set(id,{reportValidity:()=>true,elements:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:String(v),focus(){}}])),querySelectorAll:selector=>(checked[selector.match(/name="([^\"]+)"/)?.[1]]??[]).map(value=>({value}))});
}
const actor=id=>run(`accessState.actorId=${JSON.stringify(id)};`);
const check=code=>run(code);
assert.deepEqual([...run('Object.keys(roles)')],['admin','leader','head','employee']);
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
assert.equal(check("accessCanEditTask(tasks.find(t=>t.project==='aurora'))"),true);
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
actor('director');form('departmentForm',{name:'Новый отдел'},{projects:[projectId],sections:['technology']});run('saveAccessDepartment(event);');assert.ok(run("accessState.departments.some(d=>d.name==='Новый отдел')"));
actor('head-production');form('classificationForm',{departmentId:'quality',name:'Чужой справочник',kind:'entity'});run('saveAccessClassification(event);');assert.equal(run('accessState.classifications.length'),0);
form('classificationForm',{departmentId:'production',name:'Тип сборочного дефекта',kind:'classification'});run('saveAccessClassification(event);');assert.equal(run('accessState.classifications.length'),1);
// Save-time gates are rechecked even when a dialog was opened under an older role.
actor('admin');const before=run('techComponents[0].revision');form('componentForm',{});run("editingComponent=techComponents[0].id;saveComponent(event);");assert.equal(run('techComponents[0].revision'),before);
const beforeRunCount=run('productionData.runs.length');form('productionRunForm',{project:'aurora'});run('saveProductionRun(event);');assert.equal(run('productionData.runs.length'),beforeRunCount);
// Heads can change any admitted task deadline, including another department's task.
actor('head-production');const taskId=run("tasks.find(t=>t.project==='aurora'&&!t.techRequestId).id");
form('taskForm',{title:'Согласованный срок задачи',project:'aurora',owner:'team-0',plan:0,due:'2027-01-15',reason:'Изменение контрольного срока'});
run(`editingTask=${JSON.stringify(taskId)};saveTask(event);`);assert.equal(run(`tasks.find(t=>t.id===${JSON.stringify(taskId)}).due`),'2027-01-15');
// A task assigned to someone outside the project does not silently grant project access.
form('taskForm',{title:'Согласование со смежным отделом',project:'aurora',owner:'team-5',plan:0,due:'2026-11-01',reason:'Нужен допуск к проекту'});run('editingTask=null;saveTask(event);');
assert.equal(run('tasks.at(-1).awaitingAccess'),true);assert.equal(run("users.find(u=>u.id==='team-5').projects.includes('aurora')"),false);
actor('employee-production');form('taskForm',{title:'Проверить сборочную операцию',project:'aurora',owner:'employee-production',plan:999999,due:'2026-10-30',reason:'Рабочая задача'});run('editingTask=null;saveTask(event);');
const ownTaskId=run('tasks.at(-1).id');assert.equal(run('tasks.at(-1).plan'),0);
form('taskForm',{title:'Проверить сборочную операцию',project:'aurora',owner:'employee-production',plan:999999,due:'2030-12-31',reason:'Попытка изменить срок'});run(`editingTask=${JSON.stringify(ownTaskId)};saveTask(event);`);assert.equal(run(`tasks.find(t=>t.id===${JSON.stringify(ownTaskId)}).due`),'2026-10-30');
// Non-director exports are rejected before any blob or hidden snapshot is exposed.
ctx.URL={createObjectURL:()=>{throw new Error('Forbidden export attempted');},revokeObjectURL(){}};
actor('admin');run("downloadReport({},'json','forbidden');downloadProductionReport({},'json','forbidden');");
// Existing business ledgers survive access administration and its migration.
run('persist();');const data=JSON.parse(stored);assert.equal(data.technology.components.length,16);assert.equal(data.production.runs.length,12);assert.ok(data.access.events.length>=7);assert.ok(data.projectCatalog[projectId]);
const userCount=data.users.length;run('initializeAccess(JSON.parse(localStorage.getItem(storageKey)));');assert.equal(run('users.length'),userCount);
assert.equal(run("users.find(u=>u.email==='access-test@epsilon.example').position"),'Мастер участка');
console.log('Tests passed: four roles, legacy migration, role/position separation, project/department scope, self-escalation prevention, temporary grants/expiry/revocation, chat exclusions, total blocking, budgets, classifications and save-time guards.');
