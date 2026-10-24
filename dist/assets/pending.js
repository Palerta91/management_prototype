'use strict';
(()=>{
  let csrf='';const $=id=>document.getElementById(id);
  async function refresh(){try{const session=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});if(session.status===401){location.replace('/login');return;}const info=await session.json();csrf=info.csrf;if(info.mustChange){location.replace('/account');return;}$('pendingIdentity').textContent=info.user.name+' · '+info.user.email;const response=await fetch('/api/auth/bootstrap',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const boot=await response.json();if(!boot.onboardingRequired)location.replace('/dashboard');}catch{$('pendingMessage').textContent='Не удалось проверить назначение. Повторите позже.';$('pendingMessage').hidden=false;}}
  $('pendingLogout').addEventListener('click',async()=>{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'});if(response.ok||response.status===401)location.replace('/login');});
  refresh();window.setInterval(refresh,30000);
})();
