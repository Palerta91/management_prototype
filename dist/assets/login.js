'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  let session=null;
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  const secure=location.protocol==='https:';
  const safe=secure||local;

  if(!safe){
    $('transportWarning').textContent='Вход заблокирован: откройте адрес HTTPS. Не вводите пароль на этой странице.';
    $('transportWarning').hidden=false;
    document.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    return;
  }

  function message(text,success=false){
    $('authMessage').textContent=text;
    $('authMessage').dataset.kind=success?'success':'error';
    $('authMessage').hidden=false;
  }
  function mode(name){
    for(const id of ['loginForm','recoveryForm','passwordForm'])$(id).hidden=id!==name;
    $('authMessage').hidden=true;
    $('authTitle').textContent={loginForm:'Войти в систему',recoveryForm:'Восстановление доступа',passwordForm:'Личный пароль'}[name];
  }
  function hidePassword(input){
    if(!input)return;
    input.type='password';
    const toggle=document.querySelector('[data-password-toggle][aria-controls="'+input.id+'"]');
    if(toggle){toggle.textContent='Показать';toggle.setAttribute('aria-label','Показать пароль');toggle.setAttribute('aria-pressed','false');}
  }
  async function api(path,body){
    const response=await fetch('/api/auth/'+path,{
      method:body?'POST':'GET',
      credentials:'same-origin',
      cache:'no-store',
      redirect:'error',
      referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/json',...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error??'Не удалось выполнить запрос.');
    return data;
  }
  function passwordMode(){
    mode('passwordForm');
    $('authNote').textContent=session.user.email+(session.mustChange?' · Замените временный пароль для продолжения.':' · Смена личного пароля. Прежние сессии будут завершены.');
    $('backToWorkspace').hidden=session.mustChange;
  }

  document.querySelectorAll('[data-password-toggle]').forEach(toggle=>toggle.addEventListener('click',()=>{
    const input=$(toggle.getAttribute('aria-controls'));
    const reveal=input?.type==='password';
    if(!input)return;
    input.type=reveal?'text':'password';
    toggle.textContent=reveal?'Скрыть':'Показать';
    toggle.setAttribute('aria-label',reveal?'Скрыть пароль':'Показать пароль');
    toggle.setAttribute('aria-pressed',String(reveal));
    input.focus({preventScroll:true});
  }));

  $('showRecovery').addEventListener('click',()=>{
    mode('recoveryForm');
    $('authNote').textContent='Отправьте запрос ответственному за учётные записи.';
    $('recoveryEmail').value=$('loginEmail').value;
    $('recoveryEmail').focus();
  });
  $('backToLogin').addEventListener('click',()=>{
    mode('loginForm');
    $('authNote').textContent='Используйте рабочий email и свой пароль.';
    $('loginEmail').focus();
  });

  for(const id of ['loginForm','recoveryForm','passwordForm'])$(id).addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type=submit]');
    if(!form.reportValidity())return;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    try{
      if(id==='loginForm'){
        session=await api('login',{email:form.elements.email.value,password:form.elements.password.value});
        form.elements.password.value='';
        hidePassword(form.elements.password);
        if(session.mustChange)passwordMode();
        else location.replace('/dashboard');
      }
      if(id==='recoveryForm'){
        const data=await api('recovery',{email:form.elements.email.value});
        message(data.message,true);
      }
      if(id==='passwordForm'){
        if(form.elements.newPassword.value!==form.elements.confirmation.value)throw new Error('Новые пароли не совпадают.');
        await api('password',{currentPassword:form.elements.currentPassword.value,newPassword:form.elements.newPassword.value});
        form.reset();
        location.replace('/dashboard');
      }
    }catch(error){
      message(error.message);
      if(id==='loginForm'){
        form.elements.password.value='';
        hidePassword(form.elements.password);
      }
      if(id==='passwordForm'){
        for(const name of ['currentPassword','newPassword','confirmation']){
          const input=form.elements[name];input.value='';hidePassword(input);
        }
      }
    }finally{
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  });

  $('accountLogout').addEventListener('click',async()=>{
    try{await api('logout',{});location.replace('/login');}
    catch(error){message(error.message);}
  });
  api('session').then(data=>{
    session=data;
    if(data.mustChange||location.pathname==='/account')passwordMode();
    else location.replace('/dashboard');
  }).catch(()=>{});
})();
