import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=name=>readFileSync(new URL('../dist/assets/'+name,import.meta.url),'utf8');
const scripts=['seed.js','technology.js','production.js','organization.js','access.js'].map(source);
const core=source('app.js').split("document.addEventListener('click',event=>")[0];

export function policyContext(state,actorId){
  const elements=new Map(),get=id=>{
    if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:true,close(){},focus(){}});
    return elements.get(id);
  };
  const saved={baseCurrency:'RUB',users:Object.values(state.accounts).map(a=>a.profile),access:{...state.access,actorId},projectCatalog:state.projectCatalog??{}};
  const context=vm.createContext({structuredClone,crypto:webcrypto,URL,Blob,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>JSON.stringify(saved),setItem(){}},document:{getElementById:get}});
  for(const script of scripts)vm.runInContext(script,context,{timeout:2000});vm.runInContext(core,context,{timeout:2000});
  vm.runInContext("render=()=>{};renderAccessPortal=()=>{};notify=message=>{notice=message;};accessFormError=(_id,message)=>{policyError=message;};persist=()=>true;",context);
  return {run:code=>vm.runInContext(code,context,{timeout:2000}),form(id,fields,checked={}){const defaults=Object.fromEntries(['name','email','position','role','departmentId','parentId','mode','timezone','notifications','accessReason','userId','action','toId','approverId','reason','transferId','decision'].map(k=>[k,'']));elements.set(id,{reportValidity:()=>true,elements:Object.fromEntries(Object.entries({...defaults,...fields}).map(([k,v])=>[k,{value:String(v??'')} ])),querySelectorAll:selector=>(checked[selector.match(/name="([^"]+)"/)?.[1]]??[]).map(value=>({value}))});},context};
}
export function initialPolicy(profile){
  const state={accounts:{[profile.id]:{profile}},access:{version:1,governanceVersion:1,superAdminId:profile.id,departments:[],events:[],grants:[],transfers:[],classifications:[]}};
  const p=policyContext(state,profile.id),access=p.run('structuredClone(accessState)'),projectCatalog=p.run('structuredClone(planningProjects)');
  return {access,projectCatalog,planning:initialPlanning(state,access,projectCatalog)};
}
export function initialPlanning(state,access=state.access,projectCatalog=state.projectCatalog??{}){
  const contextState={...state,access,projectCatalog};
  const p=policyContext(contextState,access.superAdminId);
  const tasks=p.run('structuredClone(tasks)').map((task,index)=>({...task,code:task.code||'TASK-'+String(index+1).padStart(3,'0'),kind:'task',parentId:null,coExecutorIds:[],editorIds:[],startDate:task.startDate??'',taskType:'one_off',cadence:'weekly',activateDaysBefore:3,reminders:[],tags:[],description:task.reason??'',createdBy:task.createdBy??access.superAdminId,departmentId:task.departmentId??null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
  const departments=access.departments??[],accounts=Object.values(state.accounts??{}).map(a=>a.profile),projectTags={};
  const palette=['#55e6d2','#63a7ff','#a999ff','#f4ba4b','#f47b7b','#4ddc8b','#ff8f70','#8fc3ff'];
  for(const project of Object.keys(projectCatalog)){
    const members=accounts.filter(u=>u.status!=='deleted'&&(u.role==='leader'||u.projects?.includes(project)));
    const departmentIds=new Set(departments.filter(d=>d.projects?.includes(project)).map(d=>d.id));for(const u of members)if(u.departmentId)departmentIds.add(u.departmentId);
    const relevantDepartments=departments.filter(d=>departmentIds.has(d.id));
    projectTags[project]=[
      ...relevantDepartments.map((d,i)=>({id:'department-'+d.id,kind:'department',name:d.name,color:palette[i%palette.length],departmentId:d.id})),
      ...members.map((u,i)=>({id:'user-'+u.id,kind:'user',name:u.name,color:palette[i%palette.length],userId:u.id,active:u.status==='active'}))
    ];
  }
  return {version:1,tasks,taskEvents:[],projectTags,reminderLog:[]};
}
const operations={
  user:{form:'userForm',call:'saveAccessUser(event)'},
  userAction:{form:'accessBlockForm',call:'saveAccessBlock(event)'},
  transfer:{form:'superTransferForm',call:'saveAccessTransfer(event)'},
  decision:{form:'transferDecisionForm',call:'saveAccessTransferDecision(event)'},
  grant:{form:'incidentForm',call:'saveAccessGrant(event)'},
  department:{form:'departmentForm',call:'saveAccessDepartment(event)'},
  membership:{form:'organizationMemberForm',call:'saveOrganizationMember(event)'},
  classification:{form:'classificationForm',call:'saveAccessClassification(event)'},
  project:{form:'accessProjectForm',call:'saveAccessProject(event)'},
  revoke:{form:'accessRevokeForm',call:'if(!revokeAccessGrant(input.id,input.reason))policyError="Нет права отзыва допуска.";'}
};
export function applyPolicy(state,actorId,operation,input){
  if(!Object.hasOwn(operations,operation))throw new Error('Неизвестная операция.');const op=operations[operation];
  const p=policyContext(state,actorId);p.context.event={preventDefault(){}};p.context.input=input;p.context.policyError='';p.context.notice='';
  const checked={...(input.checked??{})},fields={...(input.fields??{})};
  if(operation==='department'&&input.id){const existing=state.access.departments.find(d=>d.id===input.id);if(existing){checked.projects=[...existing.projects];checked.sections=[...existing.sections];fields.parentId=existing.parentId??'';}}
  p.form(op.form,fields,checked);
  p.context.editingId=input.id??null;
  p.run('editingUser=editingId;editingAccessProject=editingId;editingAccessDepartment=editingId;');
  const last=p.run('accessState.events.at(-1)?.id');p.run(op.call);
  if(p.context.policyError||p.run('accessState.events.at(-1)?.id')===last)throw new Error(p.context.policyError||p.context.notice||'Операция отклонена.');
  return {users:p.run('structuredClone(users)'),access:p.run('structuredClone(accessState)'),projectCatalog:p.run('structuredClone(planningProjects)')};
}
