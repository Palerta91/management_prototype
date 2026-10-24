'use strict';
// No credentials or session tokens are written to browser storage.
(async()=>{
  let csrf='',boot=null;
  async function api(path,body){
    const endpoint=path.startsWith('/api/')?path:'/api/auth/'+path;
    const r=await fetch(endpoint,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();if(r.status===401){location.replace('/login');throw new Error('Сессия завершена. Войдите снова.');}if(!r.ok)throw new Error(data.error??'Не удалось выполнить запрос.');if(data.csrf)csrf=data.csrf;return data;
  }
  try{
    const session=await api('session');csrf=session.csrf;if(session.mustChange){location.replace('/account');return;}
    boot=await api('bootstrap');if(boot.onboardingRequired){location.replace('/pending');return;}globalThis.epsilonAuth=boot;
    globalThis.epsilonPlanning={mutate:payload=>api('/api/planning',payload),refresh:()=>api('/api/planning'),notifications:()=>api('/api/planning/notifications')};
    for(const file of ['seed.js','technology.js','production.js','organization.js','access.js','app.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/'+file+'?v=20261023-task-rights';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  }catch{document.querySelector('.shell').hidden=true;const note=document.createElement('p');note.className='auth-startup-error';note.textContent='Не удалось загрузить защищённое рабочее пространство. Откройте /login через сервер ЭПСИЛОН или повторите позже. Доступ без авторизации отключён.';document.body.append(note);return;}
  function sync(data){
    boot=data;globalThis.epsilonAuth=boot;users=structuredClone(data.workspace.users);restoreProjectCatalog(data.workspace);for(const id of Object.keys(planningProjects))if(!projectIds.includes(id))projectIds.push(id);initializeAccess(data.workspace);if(data.workspace.planning)globalThis.applyPlanningState?.(data.workspace.planning);persist();
  }
  const forms={userForm:'user',accessBlockForm:'userAction',superTransferForm:'transfer',transferDecisionForm:'decision',incidentForm:'grant',accessRevokeForm:'revoke',departmentForm:'department',organizationMemberForm:'membership',classificationForm:'classification',accessProjectForm:'project'};
  function payload(f,operation){
    const fields={},checked={};for(const el of f.elements){if(!el.name||el.type==='submit'||el.type==='button')continue;if(el.type==='checkbox'){checked[el.name]??=[];if(el.checked)checked[el.name].push(el.value);}else fields[el.name]=el.value;}
    const data={fields,checked};if(operation==='user')data.id=editingUser;if(operation==='department')data.id=editingAccessDepartment;if(operation==='project')data.id=editingAccessProject;if(operation==='revoke'){data.id=fields.grantId;data.reason=fields.reason;}return data;
  }
  function showIssued(data){
    if(!data.temporaryPassword)return;
    document.getElementById('issuedPassword').value=data.temporaryPassword;document.getElementById('issuedPassword').type='password';
    document.getElementById('issuedPasswordExpiry').textContent='Действует до '+new Date(data.expiresAt).toLocaleString('ru-RU')+'. При первом входе требуется замена.';
    document.getElementById('issuedPasswordDialog').showModal();
  }
  document.addEventListener('submit',async event=>{
    const f=event.target,operation=forms[f.id];if(!operation)return;
    event.preventDefault();event.stopImmediatePropagation();if(!f.reportValidity())return;
    const button=f.querySelector('button[type=submit]');if(button)button.disabled=true;
    try{const request=payload(f,operation),result=await api('administration',{operation,payload:request});sync(result.bootstrap);if(operation==='department'&&!request.id)organizationSelected=accessState.departments.find(d=>d.name===request.fields.name.trim())?.id??organizationSelected;f.closest('dialog')?.close();navigate(accessCanRoute(currentRoute)?currentRoute:accessHome(),{replace:true});notify('Изменения сохранены на сервере.');showIssued(result);}
    catch(error){notify(error.message);const errors={userForm:'userFormError',accessBlockForm:'accessBlockError',superTransferForm:'superTransferError',transferDecisionForm:'transferDecisionError',incidentForm:'incidentError',accessRevokeForm:'accessRevokeError',departmentForm:'departmentError',organizationMemberForm:'organizationMemberError',accessProjectForm:'accessProjectError'};if(errors[f.id])accessFormError(errors[f.id],error.message);}
    finally{if(button)button.disabled=false;}
  },true);
  document.getElementById('logoutButton').addEventListener('click',async()=>{try{await api('logout',{});document.getElementById('issuedPassword').value='';location.replace('/login');}catch(error){notify(error.message);}});
  document.getElementById('showIssuedPassword').addEventListener('click',()=>{const el=document.getElementById('issuedPassword');el.type=el.type==='password'?'text':'password';});
  document.getElementById('issuedPasswordDialog').addEventListener('close',()=>{document.getElementById('issuedPassword').value='';});
  globalThis.renderAuthPanel=async()=>{
    document.getElementById('authVaultRows').replaceChildren();
    document.getElementById('authLoadVault').hidden=!boot.canVault;
    if(accessTab!=='credentials')return;
    try{const data=await api('recovery-requests');if(accessTab!=='credentials')return;document.getElementById('authRecoveryRows').innerHTML=data.items.length?data.items.map(r=>'<div class="list-row"><div class="list-row-top"><h3>'+escapeHtml(r.name+' · '+r.email)+'</h3>'+badge(r.status==='pending'?'Ожидает':'Обработан',r.status==='pending'?'warning':'good')+'</div><p>'+escapeHtml(new Date(r.createdAt).toLocaleString('ru-RU'))+' · '+(r.assignedRole==='admin'?'Администратору':'Суперадмину')+'</p>'+(r.status==='pending'?'<button class="btn small" type="button" data-password-reset="'+r.userId+'" data-reset-request="'+r.id+'">Выдать новый временный пароль</button>':'')+'</div>').join(''):empty('Запросов на восстановление нет.');}
    catch(error){document.getElementById('authRecoveryRows').textContent=error.message;}
  };
  document.getElementById('authLoadVault').addEventListener('click',async()=>{
    try{const data=await api('vault');document.getElementById('authVaultRows').innerHTML=data.items.length?data.items.map(item=>'<div class="list-row"><h3>'+escapeHtml(item.name+' · '+item.email)+'</h3><p>До '+escapeHtml(new Date(item.expiresAt).toLocaleString('ru-RU'))+'</p><input class="vault-password" aria-label="Временный пароль '+escapeHtml(item.name)+'" type="password" value="'+escapeHtml(item.password)+'" readonly autocomplete="off" /><button class="btn small" type="button" data-show-temporary>Показать / скрыть</button></div>').join(''):empty('Действующих временных паролей нет. Личные пароли пользователей недоступны.');}
    catch(error){notify(error.message);}
  });
  globalThis.authCanResetUser=u=>u&&u.id!==boot.user.id&&u.id!==accessState.superAdminId&&u.status==='active'&&(boot.canVault||boot.user.role==='admin'&&u.role!=='leader');
  document.addEventListener('click',event=>{
    const reveal=event.target.closest('[data-show-temporary]');if(reveal){const input=reveal.parentElement.querySelector('input');input.type=input.type==='password'?'text':'password';}
    const reset=event.target.closest('[data-password-reset]');if(reset){const user=users.find(u=>u.id===reset.dataset.passwordReset);if(!globalThis.authCanResetUser(user))return;const f=document.getElementById('passwordResetForm');f.reset();f.elements.userId.value=user.id;f.elements.requestId.value=reset.dataset.resetRequest??'';document.getElementById('passwordResetName').textContent=user.name+' · '+user.email;document.getElementById('passwordResetError').hidden=true;document.getElementById('passwordResetDialog').showModal();}
  });
  document.getElementById('passwordResetForm').addEventListener('submit',async event=>{
    event.preventDefault();const f=event.target;if(!f.reportValidity())return;const button=f.querySelector('button[type=submit]');button.disabled=true;
    try{const data=await api('reset',{userId:f.elements.userId.value,requestId:f.elements.requestId.value||undefined,reason:f.elements.reason.value,identityVerified:f.elements.identityVerified.checked});document.getElementById('passwordResetDialog').close();showIssued(data);await globalThis.renderAuthPanel();}
    catch(error){accessFormError('passwordResetError',error.message);}finally{button.disabled=false;}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){document.getElementById('authVaultRows').replaceChildren();document.getElementById('issuedPassword').type='password';}});
  let lastActivity=0;const touch=()=>{if(Date.now()-lastActivity<60000)return;lastActivity=Date.now();api('touch',{}).catch(()=>{});};
  document.addEventListener('pointerdown',touch,{passive:true});document.addEventListener('keydown',touch,{passive:true});touch();
  window.setInterval(async()=>{try{const data=await api('bootstrap');if(data.onboardingRequired){location.replace('/pending');return;}if(!document.querySelector('dialog[open]')){sync(data);navigate(accessCanRoute(currentRoute)?currentRoute:accessHome(),{replace:true});}}catch{/* Fail closed on 401 in api(). */}},60000);
  render();
})();
