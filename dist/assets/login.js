'use strict';
(()=>{
  const $=id=>document.getElementById(id);let session=null;
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),safe=location.protocol==='https:'||local;
  if(!safe){$('transportWarning').textContent='Вход заблокирован: откройте защищённый адрес HTTPS. Не вводите пароль на этой странице.';$('transportWarning').hidden=false;document.querySelectorAll('input,button').forEach(el=>el.disabled=true);return;}
  if(local){$('transportWarning').textContent='Локальная проверка. Используйте только тестовые учётные записи.';$('transportWarning').hidden=false;}
  function message(text,success=false){$('authMessage').textContent=text;$('authMessage').dataset.kind=success?'success':'error';$('authMessage').hidden=false;}
  function mode(name){for(const id of ['loginForm','recoveryForm','passwordForm'])$(id).hidden=id!==name;$('authMessage').hidden=true;$('authTitle').textContent={loginForm:'Войти в систему',recoveryForm:'Восстановление доступа',passwordForm:'Личный пароль'}[name];}
  async function api(path,body){const r=await fetch('/api/auth/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json',...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.error??'Не удалось выполнить запрос.');return data;}
  function passwordMode(){mode('passwordForm');$('authNote').textContent=session.user.email+(session.mustChange?' · Замените временный пароль для продолжения.':' · Смена личного пароля. Прежние сессии будут завершены.');$('backToWorkspace').hidden=session.mustChange;}
  $('showRecovery').addEventListener('click',()=>{mode('recoveryForm');$('authNote').textContent='Отправьте запрос ответственному за учётные записи.';});
  $('backToLogin').addEventListener('click',()=>{mode('loginForm');$('authNote').textContent='Используйте рабочий email и свой пароль.';});
  for(const id of ['loginForm','recoveryForm','passwordForm'])$(id).addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,button=f.querySelector('button[type=submit]');if(!f.reportValidity())return;button.disabled=true;
    try{
      if(id==='loginForm'){session=await api('login',{email:f.elements.email.value,password:f.elements.password.value});f.elements.password.value='';if(session.mustChange)passwordMode();else location.replace('/dashboard');}
      if(id==='recoveryForm'){const data=await api('recovery',{email:f.elements.email.value});message(data.message,true);}
      if(id==='passwordForm'){if(f.elements.newPassword.value!==f.elements.confirmation.value)throw new Error('Новые пароли не совпадают.');await api('password',{currentPassword:f.elements.currentPassword.value,newPassword:f.elements.newPassword.value});f.reset();location.replace('/dashboard');}
    }catch(error){message(error.message);if(id==='loginForm')f.elements.password.value='';}finally{button.disabled=false;}
  });
  $('accountLogout').addEventListener('click',async()=>{try{await api('logout',{});location.replace('/login');}catch(error){message(error.message);}});
  api('session').then(data=>{session=data;if(data.mustChange||location.pathname==='/account')passwordMode();else location.replace('/dashboard');}).catch(()=>{});
})();
