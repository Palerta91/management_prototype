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
});
const origin='http://127.0.0.1:4195',server=createAuthServer(service,{origin,production:false});
server.listen(4195,'127.0.0.1',()=>console.log('ЭПСИЛОН auth preview: '+origin+'/login (disposable synthetic accounts; data resets on stop).'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
