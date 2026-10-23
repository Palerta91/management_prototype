import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=name=>readFileSync(new URL('../dist/assets/'+name,import.meta.url),'utf8');
const scripts=['seed.js','technology.js','production.js','access.js'].map(source);
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
  return {run:code=>vm.runInContext(code,context,{timeout:2000}),form(id,fields,checked={}){const defaults=Object.fromEntries(['name','email','position','role','departmentId','timezone','notifications','accessReason','userId','action','toId','approverId','reason','transferId','decision'].map(k=>[k,'']));elements.set(id,{reportValidity:()=>true,elements:Object.fromEntries(Object.entries({...defaults,...fields}).map(([k,v])=>[k,{value:String(v??'')} ])),querySelectorAll:selector=>(checked[selector.match(/name="([^"]+)"/)?.[1]]??[]).map(value=>({value}))});},context};
}
export function initialPolicy(profile){
  const state={accounts:{[profile.id]:{profile}},access:{version:1,governanceVersion:1,superAdminId:profile.id,departments:[],events:[],grants:[],transfers:[],classifications:[]}};
  const p=policyContext(state,profile.id);return {access:p.run('structuredClone(accessState)'),projectCatalog:p.run('structuredClone(planningProjects)')};
}
const operations={
  user:{form:'userForm',call:'saveAccessUser(event)'},
  userAction:{form:'accessBlockForm',call:'saveAccessBlock(event)'},
  transfer:{form:'superTransferForm',call:'saveAccessTransfer(event)'},
  decision:{form:'transferDecisionForm',call:'saveAccessTransferDecision(event)'},
  grant:{form:'incidentForm',call:'saveAccessGrant(event)'},
  department:{form:'departmentForm',call:'saveAccessDepartment(event)'},
  classification:{form:'classificationForm',call:'saveAccessClassification(event)'},
  project:{form:'accessProjectForm',call:'saveAccessProject(event)'},
  revoke:{form:'accessRevokeForm',call:'if(!revokeAccessGrant(input.id,input.reason))policyError="Нет права отзыва допуска.";'}
};
export function applyPolicy(state,actorId,operation,input){
  const op=operations[operation];if(!op)throw new Error('Неизвестная операция.');
  const p=policyContext(state,actorId);p.context.event={preventDefault(){}};p.context.input=input;p.context.policyError='';p.context.notice='';
  p.form(op.form,input.fields??{},input.checked??{});
  p.context.editingId=input.id??null;
  p.run('editingUser=editingId;editingAccessProject=editingId;');
  const last=p.run('accessState.events.at(-1)?.id');p.run(op.call);
  if(p.context.policyError||p.run('accessState.events.at(-1)?.id')===last)throw new Error(p.context.policyError||p.context.notice||'Операция отклонена.');
  return {users:p.run('structuredClone(users)'),access:p.run('structuredClone(accessState)'),projectCatalog:p.run('structuredClone(planningProjects)')};
}
