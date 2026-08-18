import { supabase } from './supabase';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const channels = new Map();
let currentUser = null;
let active = null;
let pending = null;
let poller = null;

function css() {
  if (document.getElementById('ram-audio-call-css')) return;
  const s = document.createElement('style');
  s.id = 'ram-audio-call-css';
  s.textContent = `
    .ram-call-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:rgba(0,0,0,.58);font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}
    .ram-call-card{width:min(360px,calc(100vw - 32px));padding:28px 24px;border-radius:22px;background:#fff;text-align:center;box-shadow:0 20px 70px #0006}
    .ram-call-avatar{width:76px;height:76px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:#0b806f;color:#fff;font-size:30px;font-weight:800}
    .ram-call-card h2{margin:0 0 6px;color:#111b21;font-size:22px}.ram-call-card p{margin:0 0 22px;color:#667781}
    .ram-call-actions{display:flex;justify-content:center;gap:12px}.ram-call-actions button{border:0;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;font-size:15px}
    .ram-call-accept{background:#25d366;color:#fff}.ram-call-reject,.ram-call-end{background:#e74c3c;color:#fff}.ram-call-muted{background:#f0f2f5;color:#111b21}
    .ram-call-status{font-size:13px;color:#667781;margin-top:10px;min-height:18px}
  `;
  document.head.appendChild(s);
}
function esc(v){return String(v||'').replace(/[&<>\\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c]));}
function removeUI(){document.querySelectorAll('.ram-call-overlay').forEach(x=>x.remove());}
function showUI(type,name){
  removeUI();
  const o=document.createElement('div');o.className='ram-call-overlay';
  const initial=(name||'?').trim().charAt(0).toUpperCase()||'?';
  o.innerHTML=`<div class="ram-call-card"><div class="ram-call-avatar">${esc(initial)}</div><h2>${type==='incoming'?'Incoming audio call':type==='outgoing'?'Calling…':'Audio call'}</h2><p>${esc(name||'Contact')}</p><div class="ram-call-status" id="ram-call-status">${type==='incoming'?'Wants to talk with you':type==='outgoing'?'Waiting for answer…':'Connected'}</div><div class="ram-call-actions" id="ram-call-actions"></div></div>`;
  document.body.appendChild(o);return o;
}
function actions(buttons){
  const box=document.getElementById('ram-call-actions');if(!box)return;box.innerHTML='';
  buttons.forEach(([label,cls,fn])=>{const b=document.createElement('button');b.textContent=label;b.className=cls;b.onclick=fn;box.appendChild(b)});
}
function status(t){const x=document.getElementById('ram-call-status');if(x)x.textContent=t;}
function audioEl(id){let a=document.getElementById(id);if(!a){a=document.createElement('audio');a.id=id;a.autoplay=true;a.playsInline=true;a.style.display='none';document.body.appendChild(a)}return a;}
async function getChats(){const {data,error}=await supabase.rpc('get_my_chats');if(error)throw error;return data||[];}
async function channelFor(chat){
  if(channels.has(chat.chat_id))return channels.get(chat.chat_id);
  await supabase.realtime.setAuth();
  const ch=supabase.channel(`call:${chat.chat_id}`,{config:{private:true,broadcast:{ack:true}}});
  const state={chat,ch};
  ch.on('broadcast',{event:'ring'},p=>onRing(chat,p.payload)).on('broadcast',{event:'offer'},p=>onOffer(chat,p.payload)).on('broadcast',{event:'answer'},p=>onAnswer(chat,p.payload)).on('broadcast',{event:'ice'},p=>onIce(chat,p.payload)).on('broadcast',{event:'accept'},p=>onAccept(chat,p.payload)).on('broadcast',{event:'reject'},p=>onReject(chat,p.payload)).on('broadcast',{event:'hangup'},p=>onHangup(chat,p.payload));
  await new Promise((resolve,reject)=>ch.subscribe((s,e)=>{if(s==='SUBSCRIBED')resolve();if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')reject(e||new Error(s))}));
  channels.set(chat.chat_id,state);return state;
}
async function send(chat,event,payload){const state=await channelFor(chat);return state.ch.send({type:'broadcast',event,payload});}
function sameCall(payload){return !payload?.from || payload.from!==currentUser?.id;}
async function onRing(chat,payload){
  if(!sameCall(payload)||active||pending)return;
  pending={chat,payload,offer:null};showUI('incoming',chat.other_display_name||chat.other_username);
  actions([['Accept','ram-call-accept',()=>acceptCall()],['Reject','ram-call-reject',()=>rejectCall()]]);
}
async function onOffer(chat,payload){
  if(!sameCall(payload))return;
  if(!pending||pending.chat.chat_id!==chat.chat_id)pending={chat,payload:null,offer:null};
  pending.offer=payload.offer;
  if(document.querySelector('.ram-call-overlay')&&pending.payload){return}
  showUI('incoming',chat.other_display_name||chat.other_username);actions([['Accept','ram-call-accept',()=>acceptCall()],['Reject','ram-call-reject',()=>rejectCall()]]);
}
async function createPeer(chat,isCaller){
  const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});
  const remote=audioEl('ram-remote-audio');pc.ontrack=e=>{remote.srcObject=e.streams[0];remote.play?.().catch(()=>{})};
  pc.onicecandidate=e=>{if(e.candidate)send(chat,'ice',{from:currentUser.id,candidate:e.candidate.toJSON?.()||e.candidate}).catch(()=>{})};
  pc.onconnectionstatechange=()=>{if(['failed','disconnected','closed'].includes(pc.connectionState)&&active)endCall(false)};
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  active={chat,pc,stream,remoteCandidates:[],isCaller};return pc;
}
async function startCall(chat){
  if(active||pending)return;
  try{await channelFor(chat);const pc=await createPeer(chat,true);showUI('outgoing',chat.other_display_name||chat.other_username);actions([['End','ram-call-end',()=>endCall(true)]]);await send(chat,'ring',{from:currentUser.id});const offer=await pc.createOffer();await pc.setLocalDescription(offer);await send(chat,'offer',{from:currentUser.id,offer});}
  catch(e){console.error(e);cleanup();alert(e?.message||'Microphone permission/call failed.');}
}
async function acceptCall(){
  if(!pending)return;const {chat}=pending;
  try{const offer=pending.offer;if(!offer){status('Connecting…');return}const pc=await createPeer(chat,false);await pc.setRemoteDescription(offer);for(const c of active.remoteCandidates.splice(0))await pc.addIceCandidate(c).catch(()=>{});const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await send(chat,'accept',{from:currentUser.id});await send(chat,'answer',{from:currentUser.id,answer});pending=null;showUI('active',chat.other_display_name||chat.other_username);actions([['Mute','ram-call-muted',toggleMute],['End','ram-call-end',()=>endCall(true)]]);status('Connected');}
  catch(e){console.error(e);cleanup();alert(e?.message||'Could not accept call.');}
}
async function rejectCall(){if(!pending)return;const {chat}=pending;await send(chat,'reject',{from:currentUser.id}).catch(()=>{});pending=null;removeUI();}
async function onAccept(chat,payload){if(!sameCall(payload)||!active||active.chat.chat_id!==chat.chat_id)return;showUI('active',chat.other_display_name||chat.other_username);actions([['Mute','ram-call-muted',toggleMute],['End','ram-call-end',()=>endCall(true)]]);status('Connecting…')}
async function onAnswer(chat,payload){if(!sameCall(payload)||!active||active.chat.chat_id!==chat.chat_id)return;try{await active.pc.setRemoteDescription(payload.answer);for(const c of active.remoteCandidates.splice(0))await active.pc.addIceCandidate(c).catch(()=>{});status('Connected');}catch(e){console.error(e)}}
async function onIce(chat,payload){if(!sameCall(payload))return;if(!active||active.chat.chat_id!==chat.chat_id||!active.pc.remoteDescription){if(active&&active.chat.chat_id===chat.chat_id)active.remoteCandidates.push(payload.candidate);return}await active.pc.addIceCandidate(payload.candidate).catch(()=>{})}
async function onReject(chat,payload){if(!sameCall(payload)||!active||active.chat.chat_id!==chat.chat_id)return;status('Call rejected');setTimeout(()=>cleanup(),600)}
async function onHangup(chat,payload){if(!sameCall(payload))return;if((active&&active.chat.chat_id===chat.chat_id)||(pending&&pending.chat.chat_id===chat.chat_id))cleanup()}
function toggleMute(){if(!active?.stream)return;const t=active.stream.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;const b=[...document.querySelectorAll('.ram-call-actions button')].find(x=>x.textContent==='Mute'||x.textContent==='Unmute');if(b)b.textContent=t.enabled?'Mute':'Unmute';}
async function endCall(notify=true){const chat=active?.chat||pending?.chat;if(notify&&chat)await send(chat,'hangup',{from:currentUser.id}).catch(()=>{});cleanup()}
function cleanup(){if(active){active.stream.getTracks().forEach(t=>t.stop());active.pc.close()}active=null;pending=null;removeUI();const a=document.getElementById('ram-remote-audio');if(a)a.srcObject=null;}
function currentChat(){
  const h=document.querySelector('.chat-head');if(!h)return null;const small=h.querySelector('small');const m=small?.textContent?.match(/^@([^\s·]+)/);const username=m?.[1];if(!username)return null;return [...channels.values()].map(x=>x.chat).find(c=>c.other_username===username)||null;
}
async function bindButtons(){document.querySelectorAll('.audio-call-icon').forEach(b=>{if(b.dataset.ramBound)return;b.dataset.ramBound='1';b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();const chat=currentChat();if(!chat){alert('Chat load nahi hua.');return}await startCall(chat)});});}
async function init(){css();const {data}=await supabase.auth.getUser();currentUser=data?.user;if(!currentUser)return;try{const chats=await getChats();for(const chat of chats)channelFor(chat).catch(console.error);}catch(e){console.error('Audio call setup',e)}await bindButtons();const obs=new MutationObserver(()=>bindButtons());obs.observe(document.body,{childList:true,subtree:true});poller=setInterval(()=>{if(!currentUser)return;bindButtons()},1200);}
window.addEventListener('beforeunload',()=>{if(poller)clearInterval(poller);cleanup();channels.forEach(({ch})=>supabase.removeChannel(ch));});
setTimeout(init,1000);
