import { supabase } from './supabase';

function addStyles(){
  if(document.getElementById('ram-header-menu-css')) return;
  const s=document.createElement('style');
  s.id='ram-header-menu-css';
  s.textContent=`
    .ram-header-more-menu{position:fixed;z-index:10050;min-width:170px;background:#fff;border:1px solid #e2e8e5;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.16);padding:6px;display:none}
    .ram-header-more-menu button{display:block;width:100%;border:0;background:transparent;text-align:left;padding:11px 13px;border-radius:9px;font-size:14px;cursor:pointer;color:#111b21}
    .ram-header-more-menu button:hover{background:#f0f2f5}
    .ram-header-more-menu .danger{color:#d32f2f;font-weight:700}
  `;
  document.head.appendChild(s);
}

let menu=null;
function closeMenu(){if(menu){menu.remove();menu=null}}
function showMenu(button){
  closeMenu();
  menu=document.createElement('div');
  menu.className='ram-header-more-menu';
  menu.innerHTML='<button class="danger" type="button">🚪 Logout</button>';
  document.body.appendChild(menu);
  const r=button.getBoundingClientRect();
  const width=170;
  menu.style.left=Math.max(8,Math.min(window.innerWidth-width-8,r.right-width))+'px';
  menu.style.top=Math.min(window.innerHeight-55,r.bottom+6)+'px';
  menu.querySelector('button').addEventListener('click',async e=>{
    e.stopPropagation();
    closeMenu();
    const ok=window.confirm('Logout from Ram Chat?');
    if(!ok)return;
    await supabase.auth.signOut();
    window.location.reload();
  });
}

function bind(){
  addStyles();
  document.querySelectorAll('.chat-actions button[title="More"]').forEach(button=>{
    if(button.dataset.ramHeaderMenuBound)return;
    button.dataset.ramHeaderMenuBound='1';
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showMenu(button)});
  });
}

document.addEventListener('click',()=>closeMenu());
window.addEventListener('resize',closeMenu);
new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
setTimeout(bind,500);
setInterval(bind,1200);
