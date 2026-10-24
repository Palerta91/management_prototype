import {MemoryStore} from '../server/store.mjs';
import {AuthService} from '../server/auth.mjs';
import {createAuthServer} from '../server/http.mjs';
import {hashPassword} from '../server/passwords.mjs';
import {randomBytes} from 'node:crypto';

// Disposable development fixture only, never used by the production entrypoint.
const store=new MemoryStore(),service=new AuthService(store,randomBytes(32));
await service.initialize({email:'superadmin@epsilon.test',passwordHash:await hashPassword('Local-Demo-Password-Only!'),name:'Тестовый Суперадмин'});
await store.transaction(async s=>{
  const profile={id:'fixture-employee',name:'Тестовый инженер',email:'fixture@epsilon.test',position:'Инженер испытаний',role:'employee',departmentId:'testing',projects:['aurora'],status:'active',sectionAccess:{},timezone:'Europe/Moscow',notifications:'assigned'};
  s.accounts[profile.id]={profile,passwordHash:'',passwordVersion:0,mustChange:true,createdAt:Date.now()};
  await service.issueTemporary(s,s.accounts[profile.id],'superadmin','Local-Temporary-Password-2026!');
  const fixtureHash=await hashPassword('Local-Organization-Password-2026!');
  for(const fixture of [
    {id:'fixture-head',name:'Сергей Михайлов',email:'head@epsilon.test',role:'head',departmentId:'production',projects:['aurora'],position:'Начальник производства'},
    {id:'fixture-pm',name:'Мария Орлова',email:'pm@epsilon.test',role:'project_manager',departmentId:'development',projects:['aurora'],position:'Руководитель проекта',pmAccess:{aurora:{planning:'write',technology:'read'}},pmDeadlines:['aurora']},
    {id:'fixture-pending',name:'Алексей Соколов',email:'pending@epsilon.test',role:'unassigned',departmentId:'',projects:[],position:'Инженер-конструктор'},
    {id:'fixture-production',name:'Анна Белова',email:'production@epsilon.test',role:'employee',departmentId:'production',projects:['aurora'],position:'Инженер-технолог'}
  ]){
    const profile={status:'active',sectionAccess:{},timezone:'Europe/Moscow',notifications:'assigned',...fixture};
    s.accounts[profile.id]={profile,passwordHash:fixtureHash,passwordVersion:1,mustChange:false,createdAt:Date.now()};
  }
});
const origin='http://127.0.0.1:4195',server=createAuthServer(service,{origin,production:false});
server.listen(4195,'127.0.0.1',()=>console.log('ЭПСИЛОН auth preview: '+origin+'/login (disposable synthetic accounts; data resets on stop).'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
