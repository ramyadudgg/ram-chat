import { supabase } from './supabase';

function addHomeLogout(){
  const rows=document.querySelectorAll('.chat-card .welcome-row');
  rows.forEach(row=>{
    if(row.querySelector('.ram-home-logout')) return;
    const button=document.createElement('button');
    button.className='ram-home-logout';
    button.type='button';
    button.textContent='🚪 Logout';
    button.style.cssText='margin-left:auto;background:#d32f2f;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;white-space:nowrap';
    button.addEventListener('click',async e=>{
      e.stopPropagation();
      if(!window.confirm('Logout from Ram Chat?')) return;
      await supabase.auth.signOut();
      window.location.reload();
    });
    row.appendChild(button);
  });
}

new MutationObserver(addHomeLogout).observe(document.body,{childList:true,subtree:true});
setTimeout(addHomeLogout,300);
setInterval(addHomeLogout,1000);
