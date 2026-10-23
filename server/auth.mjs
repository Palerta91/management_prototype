import {hashPassword,verifyPassword,passwordValid,temporaryPassword,seal,unseal,digest,token} from './passwords.mjs';
import {initialPolicy,applyPolicy,policyContext} from './policy.mjs';
import {randomUUID} from 'node:crypto';

const ok=(body={},status=200,extra={})=>({status,body,...extra});
const fail=(message,status=400)=>ok({error:message},status);
const active=a=>a?.profile.status==='active';
const genericReset='Если учётная запись существует, запрос передан ответственному. Новый временный пароль сообщат лично после проверки вашей личности.';
export class AuthService{
  constructor(store,key,{now=()=>Date.now(),sessionHours=8,tempHours=48}={}){this.store=store;this.key=key;this.now=now;this.sessionMs=sessionHours*3600000;this.tempMs=tempHours*3600000;}
  async initialize({email,passwordHash,name='Суперадмин'}){
    // The bootstrap hash is used exactly once. Restarting cannot reset a password.
    await this.store.init();
    await this.store.transaction(async s=>{
      if(s.version===1){if(s.vaultFingerprint&&s.vaultFingerprint!==digest(this.key))throw new Error('Vault key differs from the initialized Epsilon key.');return;}
      if(Object.keys(s).length)throw new Error('Existing auth state has an unsupported version; refusing to overwrite accounts.');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email??'')||!/^scrypt\$131072\$8\$1\$/.test(passwordHash??''))throw new Error('Set EPSILON_BOOTSTRAP_EMAIL and a bootstrap scrypt hash; no default password exists.');
      const profile={id:'superadmin',name,email:email.toLowerCase(),role:'leader',position:'Руководитель компании',departmentId:'management',projects:['aurora','orbit','nova'],status:'active',sectionAccess:{},timezone:'Europe/Moscow',notifications:'all'};
      Object.assign(s,{version:1,vaultFingerprint:digest(this.key),accounts:{[profile.id]:{profile,passwordHash,passwordVersion:1,mustChange:false,createdAt:this.now()}},sessions:{},requests:[],audit:[],limits:{},...initialPolicy(profile)});
      this.audit(s,profile.id,'Создан первый Суперадмин',profile.id);
    });
    this.dummyHash=await hashPassword(temporaryPassword());
  }
  audit(s,actorId,action,targetId,details={}){s.audit.push({id:randomUUID(),at:this.now(),actorId,action,targetId,...details});s.audit=s.audit.slice(-2000);}
  cleanup(s){const now=this.now();for(const [id,session]of Object.entries(s.sessions))if(session.expiresAt<=now||session.idleUntil<=now)delete s.sessions[id];for(const [id,limit]of Object.entries(s.limits))if(limit.until<=now)delete s.limits[id];for(const a of Object.values(s.accounts))if(a.temporary?.expiresAt<=now)delete a.temporary;s.requests=s.requests.filter(r=>r.status==='pending'||r.createdAt>now-30*24*3600000);}
  limited(s,key,max,windowMs){const id=digest(key),now=this.now(),item=s.limits[id];if(!item||item.until<=now){s.limits[id]={count:1,until:now+windowMs};return false;}return ++item.count>max;}
  session(s,raw){const key=digest(raw??''),session=s.sessions[key],account=s.accounts[session?.userId];if(!session||!active(account)||session.version!==account.passwordVersion||session.expiresAt<=this.now()||session.idleUntil<=this.now())return null;return {key,session,account};}
  createSession(s,account){const raw=token(),csrf=token();s.sessions[digest(raw)]={userId:account.profile.id,version:account.passwordVersion,csrf,csrfHash:digest(csrf),expiresAt:this.now()+this.sessionMs,idleUntil:this.now()+30*60000};return {raw,csrf};}
  invalidate(s,userId){for(const [id,session]of Object.entries(s.sessions))if(session.userId===userId)delete s.sessions[id];}
  isSuper(s,a){return active(a)&&a.profile.role==='leader'&&a.profile.id===s.access.superAdminId;}
  canReset(s,actor,target){
    if(!active(actor)||!active(target)||actor.profile.id===target.profile.id||target.profile.id===s.access.superAdminId)return false;
    return this.isSuper(s,actor)||actor.profile.role==='admin'&&target.profile.role!=='leader';
  }
  async issueTemporary(s,target,issuer,password){
    const next=password||temporaryPassword();if(!passwordValid(next))return fail('Временный пароль должен содержать от 16 до 128 символов.');
    target.passwordHash=await hashPassword(next);target.passwordVersion++;target.mustChange=true;
    const issuedAt=this.now(),context=target.profile.id+':'+target.passwordVersion;
    target.temporary={...seal(next,this.key,context),issuedAt,expiresAt:issuedAt+this.tempMs,issuedBy:issuer};
    this.invalidate(s,target.profile.id);this.audit(s,issuer,'Выдан временный пароль',target.profile.id,{expiresAt:target.temporary.expiresAt});
    return ok({temporaryPassword:next,expiresAt:target.temporary.expiresAt,mustChange:true});
  }
  async handle(path,method,input,{cookie='',csrf='',ip='local'}={}){
    return this.store.transaction(async s=>{
      this.cleanup(s);const auth=this.session(s,cookie),actor=auth?.account;
      if(path==='/api/auth/login'&&method==='POST'){
        const email=String(input.email??'').trim().toLowerCase();
        if(this.limited(s,'login-ip:'+ip,40,15*60000)||this.limited(s,'login-email:'+email,10,15*60000))return fail('Слишком много попыток. Повторите позже.',429);
        const a=Object.values(s.accounts).find(a=>a.profile.email===email);
        const matches=await verifyPassword(input.password,a?.passwordHash??this.dummyHash);
        if(!matches||!active(a)||a.mustChange&&!a.temporary){this.audit(s,null,'Неудачная попытка входа',a?.profile.id??null);return fail('Не удалось войти. Проверьте email и пароль или запросите восстановление.',401);}
        if(auth)delete s.sessions[auth.key];delete s.limits[digest('login-email:'+email)];const session=this.createSession(s,a);this.audit(s,a.profile.id,'Вход',a.profile.id);
        return ok({user:a.profile,mustChange:a.mustChange,csrf:session.csrf},200,{setSession:session.raw});
      }
      if(path==='/api/auth/recovery'&&method==='POST'){
        if(this.limited(s,'recovery-ip:'+ip,10,3600000))return fail('Слишком много запросов. Повторите позже.',429);
        const email=String(input.email??'').trim().toLowerCase();
        if(!this.limited(s,'recovery-email:'+email,3,3600000)){
          const target=Object.values(s.accounts).find(a=>a.profile.email===email&&active(a));
          if(target&&!s.requests.some(r=>r.userId===target.profile.id&&r.status==='pending')){
            const admins=Object.values(s.accounts).filter(a=>active(a)&&a.profile.role==='admin'&&a.profile.id!==target.profile.id);
            const assignee=target.profile.role==='leader'||!admins.length?'superadmin':'admin';
            s.requests.push({id:randomUUID(),userId:target.profile.id,status:'pending',assignedRole:assignee,createdAt:this.now()});this.audit(s,null,'Запрошено восстановление',target.profile.id,{assignedRole:assignee});
          }
        }
        return ok({message:genericReset},202);
      }
      if(!auth)return fail('Требуется вход.',401);
      if(method!=='GET'&&(!csrf||digest(csrf)!==auth.session.csrfHash))return fail('Проверка безопасности не пройдена. Обновите страницу.',403);
      // Background polling must not keep an unattended session alive.
      if(method==='POST')auth.session.idleUntil=Math.min(auth.session.expiresAt,this.now()+30*60000);
      if(path==='/api/auth/touch'&&method==='POST')return ok({ok:true});
      if(path==='/api/auth/session'&&method==='GET'){
        return ok({user:actor.profile,mustChange:actor.mustChange,csrf:auth.session.csrf});
      }
      if(path==='/api/auth/logout'&&method==='POST'){delete s.sessions[auth.key];return ok({ok:true},200,{clearSession:true});}
      if(path==='/api/auth/password'&&method==='POST'){
        if(this.limited(s,'change-password:'+actor.profile.id,6,15*60000))return fail('Слишком много попыток смены пароля.',429);
        if(!passwordValid(input.newPassword))return fail('Новый пароль должен содержать от 16 до 128 символов.');
        if(!await verifyPassword(input.currentPassword,actor.passwordHash))return fail('Текущий пароль неверен.',400);
        if(input.newPassword===input.currentPassword)return fail('Новый пароль должен отличаться от текущего.');
        actor.passwordHash=await hashPassword(input.newPassword);actor.passwordVersion++;actor.mustChange=false;delete actor.temporary;
        this.invalidate(s,actor.profile.id);const session=this.createSession(s,actor);this.audit(s,actor.profile.id,'Пользователь сменил свой пароль',actor.profile.id);
        return ok({ok:true,csrf:session.csrf},200,{setSession:session.raw});
      }
      if(actor.mustChange)return fail('Сначала замените временный пароль своим.',403);
      if(path==='/api/auth/bootstrap'&&method==='GET')return ok(this.bootstrap(s,actor));
      if(path==='/api/auth/vault'&&method==='GET'){
        if(!this.isSuper(s,actor))return fail('База временных паролей доступна только Суперадмину.',403);
        this.audit(s,actor.profile.id,'Просмотр базы временных паролей',null);
        return ok({items:Object.values(s.accounts).filter(a=>active(a)&&a.mustChange&&a.temporary).map(a=>({userId:a.profile.id,name:a.profile.name,email:a.profile.email,issuedAt:a.temporary.issuedAt,expiresAt:a.temporary.expiresAt,password:unseal(a.temporary,this.key,a.profile.id+':'+a.passwordVersion)}))});
      }
      if(path==='/api/auth/recovery-requests'&&method==='GET'){
        if(!this.isSuper(s,actor)&&actor.profile.role!=='admin')return fail('Нет права просмотра запросов.',403);
        return ok({items:s.requests.filter(r=>this.canReset(s,actor,s.accounts[r.userId])&&(this.isSuper(s,actor)||r.assignedRole==='admin')).slice(-100).reverse().map(r=>({...r,name:s.accounts[r.userId].profile.name,email:s.accounts[r.userId].profile.email}))});
      }
      if(path==='/api/auth/reset'&&method==='POST'){
        const target=s.accounts[input.userId],request=s.requests.find(r=>r.id===input.requestId&&r.userId===input.userId);
        if(!this.canReset(s,actor,target))return fail('Нет права сбрасывать пароль этого пользователя.',403);
        if(input.requestId&&(!request||request.status!=='pending'))return fail('Запрос уже обработан или не найден.',409);
        if(!input.reason?.trim()||input.identityVerified!==true)return fail('Подтвердите личность заявителя и укажите основание.');
        const result=await this.issueTemporary(s,target,actor.profile.id,input.temporaryPassword);
        if(result.status===200){for(const r of s.requests.filter(r=>r.userId===target.profile.id&&r.status==='pending'))Object.assign(r,{status:'resolved',resolvedAt:this.now(),resolvedBy:actor.profile.id,reason:input.reason.trim()});}
        return result;
      }
      if(path==='/api/auth/administration'&&method==='POST'){
        try{
          if(!input.payload||typeof input.payload!=='object')return fail('Не заданы параметры операции.');
          const draft=structuredClone(s),result=applyPolicy(draft,actor.profile.id,input.operation,input.payload),existing=new Set(Object.keys(draft.accounts));
          const newProfiles=result.users.filter(p=>!existing.has(p.id));
          if(newProfiles.length>1||Object.keys(draft.accounts).length+newProfiles.length>500)return fail('Превышен лимит учётных записей MVP.');
          for(const p of result.users)if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||p.email.length>120||!p.name.trim()||p.name.length>80||!p.position.trim()||p.position.length>120)return fail('Проверьте имя, рабочий email и должность.');
          // New accounts have no initial credential until a temporary one is issued.
          for(const profile of result.users){
            if(existing.has(profile.id)){const a=draft.accounts[profile.id];if(JSON.stringify(a.profile)!==JSON.stringify(profile)){a.profile=profile;this.invalidate(draft,profile.id);}if(profile.status!=='active')delete a.temporary;}
            else draft.accounts[profile.id]={profile,passwordHash:'',passwordVersion:0,mustChange:true,createdAt:this.now()};
          }
          draft.access=result.access;draft.projectCatalog=result.projectCatalog;
          let credential;
          if(newProfiles.length){credential=await this.issueTemporary(draft,draft.accounts[newProfiles[0].id],actor.profile.id);if(credential.status!==200)return credential;this.audit(draft,actor.profile.id,'Добавлен пользователь',newProfiles[0].id);}
          let session;const updatedActor=draft.accounts[actor.profile.id];
          if(!draft.sessions[auth.key]&&active(updatedActor))session=this.createSession(draft,updatedActor);
          Object.assign(s,draft);
          return ok({bootstrap:this.bootstrap(s,updatedActor),...(credential?.body??{}),...(session?{csrf:session.csrf}:{})},200,session?{setSession:session.raw}:{});
        }catch(error){return fail(error.message,403);}
      }
      return fail('Метод не найден.',404);
    });
  }
  bootstrap(s,actor){
    const elevated=['leader','admin'].includes(actor.profile.role),access=structuredClone(s.access);
    access.actorId=actor.profile.id;
    if(!elevated){access.events=[];access.transfers=[];access.grants=access.grants.filter(g=>g.adminId===actor.profile.id);}
    if(actor.profile.role==='admin'){access.transfers=[];access.events=access.events.map(e=>({id:e.id,at:e.at,actorId:e.actorId,actorName:e.actorName,action:e.action,target:e.target,reason:e.action.startsWith('Проект')?'Содержание изменения доступно руководителю':e.reason}));}
    const projectCatalog=structuredClone(s.projectCatalog);
    if(actor.profile.role!=='leader'){
      const policy=policyContext(s,actor.profile.id);
      for(const [id,p] of Object.entries(projectCatalog)){policy.context.probeProject=id;if(!policy.run("accessCan('budget',probeProject)"))for(const key of ['base','actual','commitments','eac'])p[key]=0;if(actor.profile.role==='admin')p.description='';}
    }
    const users=Object.values(s.accounts).filter(a=>elevated||a.profile.status!=='deleted').map(a=>({...a.profile,passwordState:a.mustChange?(a.temporary?'Временный пароль':'Требуется новый временный пароль'):'Личный пароль',temporaryExpiresAt:a.temporary?.expiresAt??null}));
    return {user:actor.profile,workspace:{users,access,projectCatalog},canVault:this.isSuper(s,actor),canHandleRecovery:this.isSuper(s,actor)||actor.profile.role==='admin',businessDataDemo:true};
  }
}
