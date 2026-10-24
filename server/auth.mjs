import {hashPassword,verifyPassword,passwordValid,temporaryPassword,seal,unseal,digest,token,safeHashForVerification} from './passwords.mjs';
import {initialPolicy,initialPlanning,applyPolicy,policyContext} from './policy.mjs';
import {randomUUID} from 'node:crypto';

const ok=(body={},status=200,extra={})=>({status,body,...extra});
const fail=(message,status=400)=>ok({error:message},status);
const active=a=>a?.profile?.status==='active';
const genericReset='Если учётная запись существует, запрос передан ответственному. Новый временный пароль сообщат лично после проверки вашей личности.';
export class AuthService{
  constructor(store,key,{now=()=>Date.now(),sessionHours=8,tempHours=48}={}){this.store=store;this.key=key;this.now=now;this.sessionMs=sessionHours*3600000;this.tempMs=tempHours*3600000;}
  async initialize({email,passwordHash,name='Суперадмин'}){
    // The bootstrap hash is used exactly once. Restarting cannot reset a password.
    await this.store.init();
    await this.store.transaction(async s=>{
      if(s.version===1){if(s.vaultFingerprint&&s.vaultFingerprint!==digest(this.key))throw new Error('Vault key differs from the initialized Epsilon key.');if(!s.planning)s.planning=initialPlanning(s);for(const task of s.planning.tasks)task.editorIds??=[];this.syncPlanningTags(s);return;}
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
  syncPlanningTags(s){
    if(!s.planning)return;
    const palette=['#55e6d2','#63a7ff','#a999ff','#f4ba4b','#f47b7b','#4ddc8b','#ff8f70','#8fc3ff'];
    const profiles=Object.values(s.accounts??{}).map(a=>a.profile);
    s.planning.projectTags??={};
    for(const project of Object.keys(s.projectCatalog??{})){
      const tags=s.planning.projectTags[project]??=[];s.planning.projectTags[project]=tags;
      const upsert=tag=>{const old=tags.find(t=>t.id===tag.id);if(old)Object.assign(old,{...tag,color:old.color??tag.color});else tags.push(tag);};
      const members=profiles.filter(u=>u.status!=='deleted'&&(u.role==='leader'||u.projects?.includes(project))),departmentIds=new Set((s.access.departments??[]).filter(d=>d.projects?.includes(project)).map(d=>d.id));
      for(const u of members)if(u.departmentId)departmentIds.add(u.departmentId);
      for(const [i,d] of (s.access.departments??[]).filter(d=>departmentIds.has(d.id)).entries())upsert({id:'department-'+d.id,kind:'department',name:d.name,color:palette[i%palette.length],departmentId:d.id});
      members.forEach((u,i)=>upsert({id:'user-'+u.id,kind:'user',name:u.name,color:palette[i%palette.length],userId:u.id,active:u.status==='active'}));
    }
  }
  planningFor(s,actor){
    this.syncPlanningTags(s);const p=policyContext(s,actor.profile.id),visibleProjects=p.run('accessProjects()');
    const tasks=s.planning.tasks.filter(task=>{
      p.context.probeTask=task;if(!p.run("accessCan('planning',probeTask.project,'read')"))return false;
      if(task.taskType==='recurring'&&task.stage==='backlog'&&actor.profile.role==='employee'&&task.createdBy!==actor.profile.id&&Date.parse(task.due+'T09:00:00Z')-Number(task.activateDaysBefore??3)*86400000>this.now())return false;
      if(actor.profile.role!=='employee')return true;
      return task.departmentId===actor.profile.departmentId||task.ownerId===actor.profile.id||task.createdBy===actor.profile.id||task.coExecutorIds?.includes(actor.profile.id)||task.editorIds?.includes(actor.profile.id);
    });
    const ids=new Set(tasks.map(t=>t.id));
    return {tasks:structuredClone(tasks),taskEvents:structuredClone(s.planning.taskEvents.filter(e=>ids.has(e.taskId))),projectTags:structuredClone(Object.fromEntries(visibleProjects.map(id=>[id,s.planning.projectTags[id]??[]])))};
  }
  planningDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const time=Date.parse(value+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;}
  planningCanManage(s,actor,task){
    const p=policyContext(s,actor.profile.id);p.context.probeTask=task;
    if(!p.run("accessCan('planning',probeTask.project,'read')"))return false;
    return task.createdBy===actor.profile.id||(task.editorIds??[]).includes(actor.profile.id);
  }
  planningCanShare(s,actor,task){
    const p=policyContext(s,actor.profile.id);p.context.probeTask=task;
    return p.run("accessCan('planning',probeTask.project,'read')")&&task.createdBy===actor.profile.id;
  }
  planningCanSetDeadline(s,actor,project){
    const p=policyContext(s,actor.profile.id);p.context.probeProject=project;
    return p.run('accessCanSetDeadline(probeProject)');
  }
  planningCanMove(s,actor,task){
    const p=policyContext(s,actor.profile.id);p.context.probeTask=task;
    if(!p.run("accessCan('planning',probeTask.project,'read')"))return false;
    if(['leader','head','project_manager'].includes(actor.profile.role)&&p.run("accessCan('planning',probeTask.project,'write')"))return true;
    return task.createdBy===actor.profile.id||task.ownerId===actor.profile.id||(task.coExecutorIds??[]).includes(actor.profile.id)||(task.editorIds??[]).includes(actor.profile.id);
  }
  planningProjectMember(s,userId,project){
    const target=s.accounts[userId];if(!active(target))return false;const p=policyContext(s,userId);p.context.probeProject=project;return p.run("accessProjects().includes(probeProject)&&accessCan('planning',probeProject,'read')");
  }
  planningActivateRecurring(s){
    const now=this.now();for(const task of s.planning.tasks){
      if(task.taskType!=='recurring'||task.stage!=='backlog')continue;
      const activateAt=Date.parse(task.due+'T09:00:00Z')-(Number(task.activateDaysBefore??3)*86400000);
      if(activateAt<=now){task.stage='work';task.updatedAt=new Date(now).toISOString();s.planning.taskEvents.push({taskId:task.id,from:'backlog',to:'work',at:new Date(now).toISOString(),system:true});}
    }
    s.planning.taskEvents=s.planning.taskEvents.slice(-2000);
  }
  planningCycleDate(date,cadence){const next=new Date(date+'T12:00:00Z');if(cadence==='monthly')next.setUTCMonth(next.getUTCMonth()+1);else next.setUTCDate(next.getUTCDate()+7);return next.toISOString().slice(0,10);}
  planningPayload(s,actor,input){
    this.syncPlanningTags(s);this.planningActivateRecurring(s);
    const operation=input.operation;
    if(operation==='tag-create'||operation==='tag-color'){
      const project=String(input.project??''),tags=s.planning.projectTags[project]??[];
      if(!this.planningCanProject(s,actor,project))return fail('Нет права изменять метки этого проекта.',403);
      if(operation==='tag-create'){
        const name=String(input.name??'').trim(),color=String(input.color??'');if(!name||name.length>48||!/^#[0-9a-f]{6}$/i.test(color))return fail('Проверьте название и цвет метки.');
        if(tags.some(t=>t.kind==='custom'&&t.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))return fail('Метка с таким названием уже существует.');
        tags.push({id:randomUUID(),kind:'custom',name,color});
      }else{
        const tag=tags.find(t=>t.id===input.tagId);if(!tag||tag.kind==='department')return fail('Можно изменить цвет только пользовательской метки.');
        if(!/^#[0-9a-f]{6}$/i.test(String(input.color??'')))return fail('Некорректный цвет метки.');tag.color=input.color;
      }
      return ok({planning:this.planningFor(s,actor)});
    }
    if(operation==='share'){
      const task=s.planning.tasks.find(t=>t.id===String(input.id??''));
      if(!task)return fail('Задача не найдена.',404);
      if(!this.planningCanShare(s,actor,task))return fail('Передать права может только создатель задачи.',403);
      const editorIds=[...new Set((Array.isArray(input.editorIds)?input.editorIds:[]).map(String))].filter(id=>id!==task.createdBy);
      if(editorIds.length>30||editorIds.some(id=>s.accounts[id]?.profile?.role==='admin'||!this.planningProjectMember(s,id,task.project)))return fail('Выберите активных пользователей с доступом к проекту.');
      task.editorIds=editorIds;task.updatedAt=new Date(this.now()).toISOString();
      this.audit(s,actor.profile.id,'Изменены права задачи',task.id,{editorIds});
      return ok({planning:this.planningFor(s,actor)});
    }
    if(operation==='delete'){
      const task=s.planning.tasks.find(t=>t.id===String(input.id??''));
      if(!task)return fail('Задача не найдена.',404);
      if(!this.planningCanManage(s,actor,task))return fail('Удалить задачу может только создатель или пользователь с переданным правом.',403);
      if(s.planning.tasks.some(t=>t.parentId===task.id))return fail('Сначала удалите или перепривяжите дочерние задачи.',409);
      s.planning.tasks=s.planning.tasks.filter(t=>t.id!==task.id);
      s.planning.taskEvents=s.planning.taskEvents.filter(e=>e.taskId!==task.id);
      s.planning.reminderLog=(s.planning.reminderLog??[]).filter(e=>!e.key?.startsWith(task.id+'|'));
      this.audit(s,actor.profile.id,'Удалена задача',task.id,{project:task.project,code:task.code,title:task.title});
      return ok({planning:this.planningFor(s,actor)});
    }
    if(operation==='deadline'){
      const task=s.planning.tasks.find(t=>t.id===String(input.id??''));
      if(!task)return fail('Задача не найдена.',404);
      if(!this.planningCanSetDeadline(s,actor,task.project))return fail('Нет права менять срок этой задачи.',403);
      const due=String(input.due??''),reason=String(input.reason??'').trim();
      if(!this.planningDate(due)||task.startDate&&task.startDate>due||!reason||reason.length>500)return fail('Проверьте срок и укажите основание изменения (до 500 символов).');
      const previousDue=task.due;task.due=due;task.forecast=due;task.updatedAt=new Date(this.now()).toISOString();
      this.audit(s,actor.profile.id,'Изменён срок задачи',task.id,{previousDue,due,reason});
      return ok({planning:this.planningFor(s,actor)});
    }
    if(operation==='create'||operation==='update'){
      const existing=operation==='update'?s.planning.tasks.find(t=>t.id===input.id):null;
      if(operation==='update'&&!existing)return fail('Задача не найдена.',404);
      const project=existing?.project??String(input.project??'');
      if(existing?!this.planningCanManage(s,actor,existing):!this.planningCanProject(s,actor,project))return fail('Нет права изменять задачу. Её создатель может передать это право отдельно.',403);
      const title=String(input.title??'').trim(),ownerId=String(input.ownerId??''),owner=s.accounts[ownerId]?.profile;
      const due=String(input.due??''),startDate=String(input.startDate??'');
      const kind=String(input.kind??'task'),parentId=String(input.parentId??'')||null;
      const taskType=String(input.taskType??'one_off'),cadence=String(input.cadence??'weekly'),activateDaysBefore=Number(input.activateDaysBefore??3);
      const stages=['backlog','approval','work','verification','decision','closed'];
      if(!title||title.length>140||!this.planningDate(due)||startDate&&!this.planningDate(startDate)||startDate&&startDate>due)return fail('Проверьте название и сроки задачи.');
      if(!['epic','task','subtask','fix'].includes(kind)||!['one_off','recurring'].includes(taskType)||!['weekly','monthly'].includes(cadence)||!Number.isInteger(activateDaysBefore)||activateDaysBefore<0||activateDaysBefore>90)return fail('Некорректный тип или расписание задачи.');
      if(!owner||!this.planningProjectMember(s,ownerId,project))return fail('Ответственный должен быть активным участником проекта.');
      const coExecutorIds=[...new Set((Array.isArray(input.coExecutorIds)?input.coExecutorIds:[]).map(String))].filter(id=>id!==ownerId);
      if(coExecutorIds.length>20||coExecutorIds.some(id=>!this.planningProjectMember(s,id,project)))return fail('Все соисполнители должны быть активными участниками проекта.');
      let parent=null;if(parentId){parent=s.planning.tasks.find(t=>t.id===parentId);if(!parent||parent.project!==project||kind==='epic'||kind==='task'&&parent.kind!=='epic'||kind==='subtask'&&parent.kind!=='task'||kind==='fix'&&!['task','subtask'].includes(parent.kind))return fail('Нарушена иерархия Эпик → Задача → Подзадача → Фикс.');}
      if(existing){const children=s.planning.tasks.filter(t=>t.parentId===existing.id),allowedChildKinds={epic:['task'],task:['subtask','fix'],subtask:['fix'],fix:[]}[kind];if(children.some(child=>!allowedChildKinds.includes(child.kind)))return fail('Нельзя изменить тип задачи: структура дочерних элементов перестанет быть корректной.');}
      const tagIds=[...new Set((Array.isArray(input.tags)?input.tags:[]).map(String))];
      if(tagIds.some(id=>!(s.planning.projectTags[project]??[]).some(tag=>tag.id===id)))return fail('Выберите метки из списка этого проекта.');
      const reminderValues=(Array.isArray(input.reminders)?input.reminders:[]).filter(Boolean);
      if(reminderValues.some(value=>typeof value!=='string'||!Number.isFinite(Date.parse(value))))return fail('Некорректное время напоминания.');
      const reminders=[...new Set(reminderValues.map(value=>new Date(value).toISOString()))];
      if(reminders.length>10||reminders.some(at=>Date.parse(at)<=this.now()||Date.parse(at)>Date.parse(due+'T23:59:59.999Z')))return fail('Напоминания должны быть в будущем, не позже срока задачи (максимум 10).');
      if(['subtask','fix'].includes(kind)&&!parentId)return fail('Для подзадачи и фикса выберите родительскую задачу.');
      const tags=s.planning.projectTags[project]??[],departmentTag=tags.find(t=>t.kind==='department'&&t.departmentId===actor.profile.departmentId);
      if(departmentTag&&!tagIds.includes(departmentTag.id)&&operation==='create')tagIds.push(departmentTag.id);
      const description=String(input.description??'').trim().slice(0,4000),data={title,project,kind,parentId,ownerId,coExecutorIds,startDate,due,taskType,cadence,activateDaysBefore,reminders,tags:tagIds,description,reason:description,departmentId:existing?.departmentId??actor.profile.departmentId??null,owner:owner.name,plan:existing?.plan??0,actual:existing?.actual??0,commitments:existing?.commitments??0,eac:existing?.eac??0,baseline:existing?.baseline??due,forecast:due};
      if(existing){
        Object.assign(existing,data,{updatedAt:new Date(this.now()).toISOString()});
      }else{
        const id=randomUUID(),code='TASK-'+String(s.planning.tasks.length+1).padStart(3,'0');
        s.planning.tasks.push({id,code,...data,editorIds:[],stage:'backlog',createdBy:actor.profile.id,createdAt:new Date(this.now()).toISOString(),updatedAt:new Date(this.now()).toISOString(),recurrenceRootId:null});
      }
      this.planningActivateRecurring(s);
      return ok({planning:this.planningFor(s,actor)});
    }
    if(operation==='move'){
      const task=s.planning.tasks.find(t=>t.id===input.id),stage=String(input.stage??'');
      if(!task||!['backlog','approval','work','verification','decision','closed'].includes(stage))return fail('Задача или статус не найдены.',404);
      if(!this.planningCanMove(s,actor,task))return fail('Нет права перемещать эту задачу.',403);
      if(stage!==task.stage){const from=task.stage;task.stage=stage;task.updatedAt=new Date(this.now()).toISOString();s.planning.taskEvents.push({taskId:task.id,from,to:stage,at:new Date(this.now()).toISOString(),actorId:actor.profile.id});
        if(stage==='closed'&&task.taskType==='recurring'){
          const due=this.planningCycleDate(task.due,task.cadence),oldDue=Date.parse(task.due+'T00:00:00Z'),newDue=Date.parse(due+'T00:00:00Z'),copy=structuredClone(task);copy.id=randomUUID();copy.code='TASK-'+String(s.planning.tasks.length+1).padStart(3,'0');copy.stage='backlog';copy.due=due;copy.startDate='';copy.reminders=(task.reminders??[]).map(at=>new Date(newDue+(Date.parse(at)-oldDue)).toISOString());copy.createdAt=new Date(this.now()).toISOString();copy.updatedAt=copy.createdAt;copy.recurrenceRootId=task.recurrenceRootId??task.id;copy.parentId=task.parentId;s.planning.tasks.push(copy);
        }
      }
      s.planning.taskEvents=s.planning.taskEvents.slice(-2000);return ok({planning:this.planningFor(s,actor)});
    }
    return fail('Неизвестная операция планирования.');
  }
  planningCanProject(s,actor,project){const p=policyContext(s,actor.profile.id);p.context.probeProject=project;return p.run("accessCan('planning',probeProject,'write')");}
  onboardingRequired(s,a){if(!active(a)||['leader','admin'].includes(a.profile.role))return false;if(a.profile.role==='unassigned')return true;return policyContext(s,a.profile.id).run('accessOnboardingRequired()');}
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
        // Accounts without a usable credential still take the scrypt path, so
        // timing does not reveal pending or not-yet-provisioned user records.
        const matches=await verifyPassword(input.password,safeHashForVerification(a?.passwordHash,this.dummyHash));
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
      if(this.onboardingRequired(s,actor))return fail('Дождитесь добавления Вашего профиля Руководителем',403);
      if(path==='/api/planning'&&method==='GET'){
        this.planningActivateRecurring(s);return ok({planning:this.planningFor(s,actor)});
      }
      if(path==='/api/planning'&&method==='POST'){
        const draft=structuredClone(s),result=this.planningPayload(draft,actor,input);
        if(result.status<400)Object.assign(s,draft);
        return result;
      }
      if(path==='/api/planning/notifications'&&method==='GET'){
        this.planningActivateRecurring(s);this.syncPlanningTags(s);const now=this.now(),items=[];s.planning.reminderLog??=[];
        const p=policyContext(s,actor.profile.id);
        for(const task of s.planning.tasks){
          p.context.probeTask=task;if(!p.run("accessCan('planning',probeTask.project,'read')"))continue;
          const recipients=[task.ownerId,...(task.coExecutorIds??[])];
          for(const reminder of task.reminders??[]){const at=Date.parse(reminder);if(!Number.isFinite(at)||at>now)continue;
            for(const userId of recipients){if(userId!==actor.profile.id)continue;const key=task.id+'|'+reminder+'|'+userId;if(s.planning.reminderLog.some(x=>x.key===key))continue;
              s.planning.reminderLog.push({key,taskId:task.id,userId,deliveredAt:new Date(now).toISOString()});items.push({taskId:task.id,title:task.title,project:task.project,due:task.due,at:reminder});
            }
          }
        }
        s.planning.reminderLog=s.planning.reminderLog.slice(-5000);return ok({items});
      }
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
          for(const p of result.users)if(!['admin','leader','head','project_manager','employee','unassigned'].includes(p.role)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||p.email.length>120||!p.name.trim()||p.name.length>80||!p.position.trim()||p.position.length>120)return fail('Проверьте имя, рабочий email, роль и должность.');
          // New accounts have no initial credential until a temporary one is issued.
          for(const profile of result.users){
            if(existing.has(profile.id)){const a=draft.accounts[profile.id];if(JSON.stringify(a.profile)!==JSON.stringify(profile)){a.profile=profile;this.invalidate(draft,profile.id);}if(profile.status!=='active')delete a.temporary;}
            else draft.accounts[profile.id]={profile,passwordHash:'',passwordVersion:0,mustChange:true,createdAt:this.now()};
          }
          draft.access=result.access;draft.projectCatalog=result.projectCatalog;this.syncPlanningTags(draft);
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
    if(this.onboardingRequired(s,actor))return {user:actor.profile,onboardingRequired:true,waitingMessage:'Дождитесь добавления Вашего профиля Руководителем',canVault:false,canHandleRecovery:false,businessDataDemo:true,workspace:{users:[actor.profile],projectCatalog:{},access:{version:1,governanceVersion:1,actorId:actor.profile.id,superAdminId:null,departments:[],grants:[],events:[],transfers:[],classifications:[]}}};
    const elevated=['leader','admin'].includes(actor.profile.role),access=structuredClone(s.access);
    access.actorId=actor.profile.id;
    if(!elevated){access.events=[];access.transfers=[];access.grants=access.grants.filter(g=>g.adminId===actor.profile.id);}
    if(actor.profile.role==='admin'){access.transfers=[];access.events=access.events.map(e=>({id:e.id,at:e.at,actorId:e.actorId,actorName:e.actorName,action:e.action,target:e.target,reason:e.action.startsWith('Проект')?'Содержание изменения доступно руководителю':e.reason}));}
    const projectCatalog=structuredClone(s.projectCatalog);
    if(actor.profile.role!=='leader'){
      const policy=policyContext(s,actor.profile.id);
      for(const [id,p] of Object.entries(projectCatalog)){policy.context.probeProject=id;if(!policy.run("accessCan('budget',probeProject)"))for(const key of ['base','actual','commitments','eac'])p[key]=0;if(actor.profile.role==='admin')p.description='';}
    }
    const p=policyContext(s,actor.profile.id),allowedProjects=p.run('accessProjects()');
    const users=Object.values(s.accounts).filter(a=>{
      if(a.profile.status==='deleted'&&!elevated)return false;
      if(elevated)return true;
      return a.profile.id===actor.profile.id||a.profile.role==='leader'||a.profile.projects?.some(id=>allowedProjects.includes(id))||a.profile.departmentId===actor.profile.departmentId;
    }).map(a=>({...a.profile,passwordState:a.mustChange?(a.temporary?'Временный пароль':'Требуется новый временный пароль'):'Личный пароль',temporaryExpiresAt:a.temporary?.expiresAt??null}));
    this.planningActivateRecurring(s);
    return {user:actor.profile,onboardingRequired:false,workspace:{users,access,projectCatalog,planning:this.planningFor(s,actor)},canVault:this.isSuper(s,actor),canHandleRecovery:this.isSuper(s,actor)||actor.profile.role==='admin',businessDataDemo:true};
  }
}
