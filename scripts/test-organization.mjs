import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {MemoryStore,PostgresStore} from '../server/store.mjs';
import {Pool} from 'pg';
import {AuthService} from '../server/auth.mjs';
import {createAuthServer} from '../server/http.mjs';
import {hashPassword} from '../server/passwords.mjs';
import {policyContext} from '../server/policy.mjs';

const waiting='Дождитесь добавления Вашего профиля Руководителем';
class ObservedPostgresStore extends PostgresStore{async transaction(fn){let snapshot;const result=await super.transaction(async s=>{const value=await fn(s);snapshot=structuredClone(s);return value;});this.state=snapshot;return result;}}
const usePostgres=process.env.EPSILON_TEST_POSTGRES==='1';
const database=process.env.EPSILON_ORGANIZATION_TEST_DB??'epsilon_organization_test';
if(usePostgres)assert.match(database,/^epsilon_organization_test(?:_[a-z0-9]+)?$/,'Only disposable organization test databases are allowed');
const store=usePostgres?new ObservedPostgresStore(new Pool({host:'127.0.0.1',port:55439,database,user:'epsilon_test',max:3})):new MemoryStore();
try{
if(usePostgres){await store.init();assert.equal(await store.transaction(s=>Object.keys(s).length),0,'Organization tests require an EMPTY disposable database; existing records will not be overwritten.');}
const service=new AuthService(store,randomBytes(32));
const rootPassword='Synthetic-Organization-Root-2026!',personal='Synthetic-Organization-Personal-2026!';
await service.initialize({email:'root@organization.test',passwordHash:await hashPassword(rootPassword)});
const call=(path,body,session={})=>service.handle('/api/auth/'+path,body?'POST':'GET',body??{},session);
const login=async(email,password)=>{const r=await call('login',{email,password});assert.equal(r.status,200,r.body.error);return {cookie:r.setSession,csrf:r.body.csrf};};
const root=await login('root@organization.test',rootPassword);
const administer=(session,operation,fields,checked={},id)=>call('administration',{operation,payload:{fields,checked,id}},session);
const userFields=(email,role,departmentId)=>({name:email.split('@')[0],email,role,departmentId,position:'Инженер',timezone:'Europe/Moscow',notifications:'assigned',accessReason:'Тестовый профиль'});
async function create(email,role,departmentId,extra={}){
  const r=await administer(root,'user',{...userFields(email,role,departmentId),...extra},{projects:['aurora']});assert.equal(r.status,200,r.body.error);
  const id=r.body.bootstrap.workspace.users.find(u=>u.email===email).id;let session=await login(email,r.body.temporaryPassword);
  const changed=await call('password',{currentPassword:r.body.temporaryPassword,newPassword:personal},session);assert.equal(changed.status,200);
  session={cookie:changed.setSession,csrf:changed.body.csrf};return {id,session};
}
const head=await create('head@organization.test','head','production');
const pm=await create('pm@organization.test','project_manager','development',{'pm-aurora-planning':'write','pm-aurora-technology':'read'});
const deadlineTask=store.state.planning.tasks.find(t=>t.project==='aurora');assert.ok(deadlineTask,'Seed planning task must exist');const unchangedTitle=deadlineTask.title;
let deadlineResult=await service.handle('/api/planning','POST',{operation:'deadline',id:deadlineTask.id,due:'2027-01-15',reason:'Перенос контрольной даты по согласованному плану'},head.session);
assert.equal(deadlineResult.status,200,deadlineResult.body.error);assert.equal(store.state.planning.tasks.find(t=>t.id===deadlineTask.id).due,'2027-01-15');assert.equal(store.state.planning.tasks.find(t=>t.id===deadlineTask.id).title,unchangedTitle);
assert.equal((await service.handle('/api/planning','POST',{operation:'update',id:deadlineTask.id,title:'Подмена карточки'},head.session)).status,403,'Deadline authority must not grant task edit rights');
assert.equal((await service.handle('/api/planning','POST',{operation:'deadline',id:deadlineTask.id,due:'2027-02-01',reason:'Нет назначенного права на срок'},pm.session)).status,403,'Project managers need an explicit deadline grant');
const orphan=await create('pending@organization.test','unassigned','production');
assert.equal(store.state.accounts[orphan.id].profile.departmentId,'');
assert.deepEqual(store.state.accounts[orphan.id].profile.projects,[],'Forged projects must not admit a user without a role');
const pendingBootstrap=await call('bootstrap',null,orphan.session);assert.equal(pendingBootstrap.status,200);
assert.equal(pendingBootstrap.body.onboardingRequired,true);assert.equal(pendingBootstrap.body.waitingMessage,waiting);
assert.equal(pendingBootstrap.body.workspace.users.length,1);assert.deepEqual(pendingBootstrap.body.workspace.projectCatalog,{});
for(const key of ['departments','events','grants','transfers','classifications'])assert.deepEqual(pendingBootstrap.body.workspace.access[key],[]);
for(const path of ['vault','recovery-requests'])assert.equal((await call(path,null,orphan.session)).status,403);
assert.equal((await administer(orphan.session,'department',{name:'Обход',reason:'Попытка'})).body.error,waiting);
// Waiting users cannot fetch the business page or demonstration data directly.
const server=createAuthServer(service,{origin:'http://127.0.0.1:4198',production:false});
await new Promise(resolve=>server.listen(4198,'127.0.0.1',resolve));
try{
  const headers={};
  // Use the configured cookie name from an actual login response.
  const response=await fetch('http://127.0.0.1:4198/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:4198'},body:JSON.stringify({email:'pending@organization.test',password:personal})});
  assert.equal(response.status,200);headers.Cookie=response.headers.get('set-cookie').split(';')[0];
  const request=path=>fetch('http://127.0.0.1:4198'+path,{headers,redirect:'manual'});
  const dashboard=await request('/dashboard');assert.equal(dashboard.status,303);assert.equal(dashboard.headers.get('location'),'/pending');
  for(const asset of ['/assets/seed.js','/assets/organization.js','/assets/app.js'])assert.equal((await request(asset)).status,403);
  const page=await request('/pending');assert.equal(page.status,200);assert.match(await page.text(),new RegExp(waiting));
  assert.equal((await request('/account')).status,200);
}finally{await new Promise(resolve=>server.close(resolve));}
// The head may create only a child department in their own scope.
const departmentFields={name:'Участок точной сборки',parentId:'production',reason:'Выделение участка'};
assert.equal((await administer(head.session,'department',{...departmentFields,parentId:''},{projects:['aurora'],sections:['production']})).status,403);
assert.equal((await administer(head.session,'department',{...departmentFields,parentId:'quality'},{projects:['aurora'],sections:['production']})).status,403);
assert.equal((await administer(head.session,'department',departmentFields,{projects:['orbit'],sections:['production']})).status,403);
assert.equal((await administer(head.session,'department',departmentFields,{projects:['aurora'],sections:['quality']})).status,403);
let result=await administer(head.session,'department',departmentFields,{projects:['aurora'],sections:['production']});assert.equal(result.status,200,result.body.error);
const child=store.state.access.departments.find(d=>d.name===departmentFields.name),original=structuredClone(child);
assert.equal(child.parentId,'production');
assert.equal((await administer(pm.session,'department',{name:'Взлом переименования',reason:'Не свой отдел'}, {},child.id)).status,403);
assert.equal((await administer(root,'department',{name:child.name.toUpperCase(),reason:'Дубликат'},{projects:['aurora'],sections:['production']})).status,403);
// Assign an existing user: password, ID and authentication history survive.
const orphanHash=store.state.accounts[orphan.id].passwordHash,orphanVersion=store.state.accounts[orphan.id].passwordVersion;
const member={mode:'assign',departmentId:child.id,userId:orphan.id,position:'Мастер участка',reason:'Включение в состав'};
result=await administer(head.session,'membership',member,{projects:['aurora']});assert.equal(result.status,200,result.body.error);assert.equal(result.body.temporaryPassword,undefined);
assert.equal(store.state.accounts[orphan.id].passwordHash,orphanHash);assert.equal(store.state.accounts[orphan.id].passwordVersion,orphanVersion);
assert.equal((await call('session',null,orphan.session)).status,401,'Membership changes revoke existing sessions');
orphan.session=await login('pending@organization.test',personal);
assert.equal((await call('bootstrap',null,orphan.session)).body.onboardingRequired,false);
let policy=policyContext(store.state,orphan.id);assert.equal(policy.run("accessCan('production','aurora','write')"),true);assert.equal(policy.run("accessCan('production','aurora','verify')"),false);
// A rename ignores forged scope changes and keeps account membership intact.
result=await administer(head.session,'department',{name:'Участок серийной сборки',reason:'Уточнение наименования',parentId:'quality'},{projects:['orbit'],sections:['quality']},child.id);assert.equal(result.status,200,result.body.error);
const renamed=store.state.access.departments.find(d=>d.id===child.id);assert.equal(renamed.name,'Участок серийной сборки');assert.deepEqual(renamed.projects,original.projects);assert.deepEqual(renamed.sections,original.sections);assert.equal(renamed.parentId,original.parentId);assert.equal(store.state.accounts[orphan.id].profile.departmentId,child.id);
assert.equal(store.state.access.events.at(-1).reason,'Уточнение наименования');
// A deliberate read-only grant by a company leader remains usable, without
// silently lifting the employee's write/verification ceiling.
result=await administer(root,'user',{...userFields('pending@organization.test','employee',child.id),'section-quality':'read'},{projects:['aurora']},orphan.id);assert.equal(result.status,200,result.body.error);
policy=policyContext(store.state,orphan.id);assert.equal(policy.run("accessCan('quality','aurora')"),true);assert.equal(policy.run("accessCan('quality','aurora','write')"),false);
// A project manager can provision employees but cannot promote roles or exceed their own rights.
const pmMember={mode:'new',departmentId:'development',name:'Инженер РП',email:'pm-staff@organization.test',position:'Инженер-конструктор',reason:'Команда проекта',role:'leader'};
assert.equal((await administer(pm.session,'membership',{...pmMember,departmentId:'quality'},{projects:['aurora']})).status,403);
assert.equal((await administer(pm.session,'membership',pmMember,{projects:['orbit']})).status,403);
result=await administer(pm.session,'membership',pmMember,{projects:['aurora']});assert.equal(result.status,200,result.body.error);assert.ok(result.body.temporaryPassword);assert.ok(result.body.expiresAt>Date.now());
const pmStaff=result.body.bootstrap.workspace.users.find(u=>u.email===pmMember.email);assert.equal(pmStaff.role,'employee');
const temporary=result.body.temporaryPassword;let fresh=await login(pmMember.email,temporary);
assert.equal((await call('bootstrap',null,fresh)).status,403,'New users must first change the temporary password');
const change=await call('password',{currentPassword:temporary,newPassword:personal},fresh);assert.equal(change.status,200);
policy=policyContext(store.state,pmStaff.id);assert.equal(policy.run("accessCan('technology','aurora')"),true);assert.equal(policy.run("accessCan('technology','aurora','write')"),false);assert.equal(policy.run("accessCan('changes','aurora')"),false);assert.equal(policy.run("accessCan('budget','aurora')"),false);
assert.equal(policy.run("accessCan('planning','orbit')"),false);
for(const targetId of ['superadmin',head.id,pm.id])assert.equal((await administer(pm.session,'membership',{...member,userId:targetId,departmentId:'development'},{projects:['aurora']})).status,403);
assert.equal((await administer(pm.session,'user',{...userFields(pmMember.email,'leader','development'),accessReason:'Попытка повышения'},{projects:['aurora']},pmStaff.id)).status,200);
assert.equal(store.state.accounts[pmStaff.id].profile.role,'employee');
// Removing membership closes content, but never destroys the account, password or audit trail.
result=await administer(head.session,'membership',{...member,mode:'remove',reason:'Исключение из отдела'},{});assert.equal(result.status,200,result.body.error);
assert.equal(store.state.accounts[orphan.id].profile.role,'unassigned');assert.equal(store.state.accounts[orphan.id].passwordHash,orphanHash);
orphan.session=await login('pending@organization.test',personal);assert.equal((await call('bootstrap',null,orphan.session)).body.waitingMessage,waiting);
assert.ok(store.state.access.events.some(e=>e.action==='Сотрудник исключён из отдела'));
// A new account without any admitted projects remains in the same closed state.
result=await administer(head.session,'membership',{mode:'new',departmentId:child.id,name:'Без допуска',email:'no-project@organization.test',position:'Стажёр',reason:'Ожидание назначения'},{});assert.equal(result.status,200,result.body.error);
const noProject=Object.values(store.state.accounts).find(a=>a.profile.email==='no-project@organization.test');assert.ok(noProject,'Newly created account must be persisted');assert.equal(service.onboardingRequired(store.state,noProject),true);
assert.equal(JSON.stringify(store.state).includes(temporary),false,'Temporary passwords must only be persisted encrypted');
result=await administer(root,'user',userFields(pmMember.email,'head','development'),{projects:['aurora']},pmStaff.id);assert.equal(result.status,200,result.body.error);
policy=policyContext(store.state,pmStaff.id);assert.equal(policy.run("accessCan('technology','aurora','verify')"),true,'Only an authorized managerial role assignment replaces an employee ceiling');
if(usePostgres){const persisted=await store.transaction(s=>structuredClone(s));assert.equal(persisted.accounts[orphan.id].profile.role,'unassigned');assert.equal(persisted.access.departments.find(d=>d.id===child.id).name,'Участок серийной сборки');}
console.log('Organization tests passed ('+(usePostgres?'PostgreSQL':'MemoryStore')+'): scoped hierarchy, rename stability, pending isolation/API/assets, temporary provisioning, password-preserving assignment, permission ceilings, protected roles, removal, audit and empty-project onboarding.');
}finally{await store.close();}
