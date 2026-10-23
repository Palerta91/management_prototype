import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {MemoryStore,PostgresStore} from '../server/store.mjs';
import {Pool} from 'pg';
import {AuthService} from '../server/auth.mjs';
import {createAuthServer} from '../server/http.mjs';
import {hashPassword,verifyPassword} from '../server/passwords.mjs';

const rootPassword='Synthetic-Root-Password-2026!',personal='Synthetic-Personal-Secret-2026!';
class ObservedPostgresStore extends PostgresStore{async transaction(fn){let snapshot;const result=await super.transaction(async s=>{const value=await fn(s);snapshot=structuredClone(s);return value;});this.state=snapshot;return result;}}
let now=Date.now();const usePostgres=process.env.EPSILON_TEST_POSTGRES==='1';
const store=usePostgres?new ObservedPostgresStore(new Pool({host:'127.0.0.1',port:55439,database:'epsilon_auth_test',user:'epsilon_test',max:3})):new MemoryStore();
try{
if(usePostgres){await store.init();assert.equal(await store.transaction(s=>Object.keys(s).length),0,'PostgreSQL test requires an EMPTY disposable database; existing records will not be overwritten.');}
const service=new AuthService(store,randomBytes(32),{now:()=>now});
await service.initialize({email:'root@epsilon.test',passwordHash:await hashPassword(rootPassword)});
const call=(path,body,session={})=>service.handle('/api/auth/'+path,body?'POST':'GET',body??{},session);
const login=async(email,password)=>{const r=await call('login',{email,password});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.setSession,csrf:r.body.csrf};};
let root=await login('root@epsilon.test',rootPassword);
assert.equal((await call('bootstrap')).status,401);
assert.equal((await call('administration',{operation:'user',payload:{}},{cookie:root.cookie})).status,403);
assert.equal((await call('session',null,root)).body.csrf,(await call('session',null,root)).body.csrf,'Opening another tab must not invalidate CSRF');
const fields=(name,email,role='employee')=>({name,email,position:'Инженер',role,departmentId:'development',timezone:'Europe/Moscow',notifications:'assigned',accessReason:'Тестовое назначение'});
async function create(name,email,role='employee'){
  const r=await call('administration',{operation:'user',payload:{fields:fields(name,email,role),checked:{projects:['aurora']}}},root);
  assert.equal(r.status,200,JSON.stringify(r.body));const user=r.body.bootstrap.workspace.users.find(u=>u.email===email);assert.ok(user);assert.ok(r.body.temporaryPassword);return {id:user.id,password:r.body.temporaryPassword};
}
const employee=await create('Тестовый сотрудник','employee@epsilon.test');
assert.equal((await call('administration',{operation:'constructor',payload:{}},root)).status,403);
assert.equal((await call('administration',{operation:'user',payload:{fields:fields('Некорректная роль','invalid-role@epsilon.test','constructor'),checked:{projects:['aurora']}}},root)).status,403);
assert.equal((await call('reset',{userId:'constructor',reason:'Некорректный id',identityVerified:true},root)).status,403);
const vault1=await call('vault',null,root);assert.equal(vault1.body.items.find(u=>u.userId===employee.id).password,employee.password);
let staff=await login('employee@epsilon.test',employee.password);
assert.equal((await call('bootstrap',null,staff)).status,403,'Temporary password cannot open the workspace');
assert.equal((await call('password',{currentPassword:'wrong',newPassword:personal},staff)).status,400);
assert.equal((await call('password',{currentPassword:employee.password,newPassword:'short'},staff)).status,400);
const changed=await call('password',{currentPassword:employee.password,newPassword:personal},staff);assert.equal(changed.status,200);const oldStaff=staff;staff={cookie:changed.setSession,csrf:changed.body.csrf};
assert.equal((await call('session',null,oldStaff)).status,401,'Changing a password invalidates old sessions');
assert.equal((await call('login',{email:'employee@epsilon.test',password:employee.password})).status,401);
assert.equal((await call('vault',null,root)).body.items.some(i=>i.userId===employee.id),false);
assert.equal(store.state.accounts[employee.id].temporary,undefined);assert.equal(await verifyPassword(personal,store.state.accounts[employee.id].passwordHash),true);
assert.equal((await call('vault',null,staff)).status,403);assert.equal((await call('administration',{operation:'user',payload:{fields:fields('Hack','hack@epsilon.test','leader')}},staff)).status,403);
assert.equal((await call('bootstrap',null,staff)).body.user.role,'employee');
// Recovery is non-enumerating, deduplicated, does not reset a password by itself.
const existing=await call('recovery',{email:'employee@epsilon.test'}),missing=await call('recovery',{email:'missing@epsilon.test'});assert.deepEqual(existing.body,missing.body);
await call('recovery',{email:'employee@epsilon.test'});assert.equal(store.state.requests.length,1);assert.equal(store.state.requests[0].assignedRole,'superadmin');
assert.equal((await call('session',null,staff)).status,200);
assert.equal((await call('recovery-requests',null,root)).body.items.length,1);
let reset=await call('reset',{userId:employee.id,requestId:store.state.requests[0].id,reason:'Проверка личности',identityVerified:false},root);assert.equal(reset.status,400);
reset=await call('reset',{userId:employee.id,requestId:store.state.requests[0].id,reason:'Личность подтверждена лично',identityVerified:true},root);assert.equal(reset.status,200);
assert.equal((await call('session',null,staff)).status,401);assert.equal((await call('login',{email:'employee@epsilon.test',password:personal})).status,401);
assert.equal(store.state.requests[0].status,'resolved');assert.equal((await call('reset',{userId:employee.id,requestId:store.state.requests[0].id,reason:'Повтор',identityVerified:true},root)).status,409);
// Admin handles ordinary users, never leaders; vault access remains superadmin-only.
const admin=await create('Администратор','admin@epsilon.test','admin'),leader=await create('Руководитель','leader@epsilon.test','leader');
let adminSession=await login('admin@epsilon.test',admin.password);const adminChange=await call('password',{currentPassword:admin.password,newPassword:'Admin-Personal-Password-2026!'},adminSession);assert.equal(adminChange.status,200);adminSession={cookie:adminChange.setSession,csrf:adminChange.body.csrf};
assert.equal((await call('vault',null,adminSession)).status,403);
assert.equal((await call('reset',{userId:leader.id,reason:'Запрещённый сброс',identityVerified:true},adminSession)).status,403);
assert.equal((await call('reset',{userId:'superadmin',reason:'Запрещённый сброс',identityVerified:true},adminSession)).status,403);
assert.equal((await call('reset',{userId:'superadmin',reason:'Самосброс',identityVerified:true},root)).status,403);
await call('recovery',{email:'leader@epsilon.test'});assert.equal(store.state.requests.at(-1).assignedRole,'superadmin');
await call('recovery',{email:'employee@epsilon.test'});assert.equal(store.state.requests.at(-1).assignedRole,'admin');
assert.equal((await call('recovery-requests',null,adminSession)).body.items.some(r=>r.userId===leader.id),false);
const adminReset=await call('reset',{userId:employee.id,reason:'Личность сотрудника проверена',identityVerified:true},adminSession);assert.equal(adminReset.status,200);assert.equal((await call('vault',null,root)).body.items.find(r=>r.userId===employee.id).password,adminReset.body.temporaryPassword);
assert.equal((await call('bootstrap',null,adminSession)).body.workspace.projectCatalog.aurora.base,0,'Real server-side budget metadata must not leak to administrators');
// Client-side role/state edits cannot reach protected account mutation endpoints.
const forged=await call('administration',{operation:'userAction',payload:{fields:{userId:leader.id,action:'block',reason:'Попытка обойти ограничения'}}},adminSession);assert.equal(forged.status,403);assert.equal(store.state.accounts[leader.id].profile.status,'active');
// Bootstrap is one-time: restarting never restores the initial password or owner.
const previousHash=store.state.accounts.superadmin.passwordHash;await service.initialize({email:'other@epsilon.test',passwordHash:await hashPassword('Different-Bootstrap-Password!')});assert.equal(store.state.accounts.superadmin.passwordHash,previousHash);
await assert.rejects(()=>new AuthService(store,randomBytes(32)).initialize({}),/Vault key differs/);
// No plaintext personal/temporary passwords in persistence or ordinary API output.
for(const secret of [rootPassword,personal,employee.password,adminReset.body.temporaryPassword])assert.equal(JSON.stringify(store.state).includes(secret),false);
for(const secret of ['passwordHash','ciphertext','csrfHash','EPSILON_VAULT_KEY'])assert.equal(JSON.stringify((await call('bootstrap',null,root)).body).includes(secret),false);
// HTTP boundary: no assets before login, no cross-site JSON, no missing CSRF,
// HttpOnly/SameSite cookies and no-store, forced password change, HTTPS fail-closed.
const server=createAuthServer(service,{origin:'http://127.0.0.1:4197',production:false});await new Promise(resolve=>server.listen(4197,'127.0.0.1',resolve));
try{
  const base='http://127.0.0.1:4197',http=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
  assert.equal((await http('/dashboard')).status,303);assert.equal((await http('/assets/seed.js')).status,401);assert.equal((await http('/login')).status,200);
  const headers={'Content-Type':'application/json',Origin:base};
  assert.equal((await http('/api/auth/login',{method:'POST',headers:{...headers,Origin:'https://attacker.test'},body:JSON.stringify({email:'root@epsilon.test',password:rootPassword})})).status,403);
  const response=await http('/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'root@epsilon.test',password:rootPassword})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.equal(response.headers.get('cache-control'),'no-store');
  const sessionBody=await response.json();const cookieHeader=cookie.split(';')[0];assert.equal((await http('/assets/seed.js',{headers:{Cookie:cookieHeader}})).status,200);
  assert.equal((await http('/api/auth/logout',{method:'POST',headers:{...headers,Cookie:cookieHeader},body:'{}'})).status,403);
  assert.equal((await http('/api/auth/logout',{method:'POST',headers:{...headers,Cookie:cookieHeader,'X-CSRF-Token':sessionBody.csrf},body:'{}'})).status,200);
assert.equal((await http('/assets/seed.js',{headers:{Cookie:cookieHeader}})).status,401);
}finally{await new Promise(resolve=>server.close(resolve));}
assert.throws(()=>createAuthServer(service,{origin:'http://example.test',production:true}),/HTTPS/);
assert.throws(()=>createAuthServer(service,{origin:'http://example.test',production:false}),/loopback/);
// Actual server governance follows the current holder, not a client-side flag.
const third=await create('Третий руководитель','third@epsilon.test','leader');
let receiver=await login('leader@epsilon.test',leader.password),approver=await login('third@epsilon.test',third.password);
let response=await call('password',{currentPassword:leader.password,newPassword:'Receiver-Personal-Password-2026!'},receiver);receiver={cookie:response.setSession,csrf:response.body.csrf};
response=await call('password',{currentPassword:third.password,newPassword:'Approver-Personal-Password-2026!'},approver);approver={cookie:response.setSession,csrf:response.body.csrf};
response=await call('administration',{operation:'transfer',payload:{fields:{toId:leader.id,approverId:third.id,reason:'Независимое согласование'}}},root);assert.equal(response.status,200,JSON.stringify(response.body));const transferId=store.state.access.transfers.at(-1).id;
const decision={operation:'decision',payload:{fields:{transferId,decision:'approve',reason:'Проверено третьим руководителем'}}};
assert.equal((await call('administration',decision,receiver)).status,403);assert.equal(store.state.access.superAdminId,'superadmin');
assert.equal((await call('administration',decision,approver)).status,200);assert.equal(store.state.access.superAdminId,leader.id);
assert.equal((await call('vault',null,root)).status,403);assert.equal((await call('vault',null,receiver)).status,200);
// Polling cannot renew an unattended session beyond the idle limit.
const idleStart=store.state.sessions[Object.keys(store.state.sessions).find(k=>store.state.sessions[k].userId==='superadmin')].idleUntil;
now+=10*60000;await call('bootstrap',null,root);assert.equal(store.state.sessions[Object.keys(store.state.sessions).find(k=>store.state.sessions[k].userId==='superadmin')].idleUntil,idleStart);
now+=21*60000;assert.equal((await call('session',null,root)).status,401);
// Expired temporary credentials do not work and do not remain in the vault.
now+=49*3600000;const expired=await call('login',{email:'employee@epsilon.test',password:adminReset.body.temporaryPassword});assert.equal(expired.status,401);assert.equal(store.state.accounts[employee.id].temporary,undefined);
// Rate limits remain committed on a rejected authentication attempt.
for(let i=0;i<11;i++){const result=await service.handle('/api/auth/login','POST',{email:'missing@epsilon.test',password:'incorrect'},{ip:'test-rate-limit'});if(i===10)assert.equal(result.status,429);}
console.log('Auth tests passed ('+(usePostgres?'PostgreSQL':'MemoryStore')+'): scrypt, encrypted temporary vault, personal-password non-disclosure, forced rotation, expiry, session invalidation, server permissions, protected leaders, admin/superadmin recovery, CSRF/origin/rate limits, protected assets and HTTPS prerequisites.');
}finally{await store.close();}
