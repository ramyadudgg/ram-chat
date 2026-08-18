// Audio-call UX/device guard. Keeps the call UI responsive even when the browser has no usable microphone.
(function(){
  function bind(){
    document.querySelectorAll('.audio-call-icon').forEach(btn=>{
      if(btn.dataset.ramDeviceFix) return;
      btn.dataset.ramDeviceFix='1';
      btn.addEventListener('click',async function(){
        // The main audio-call module handles signaling. This guard only provides
        // a useful browser/device diagnostic instead of an abrupt device error.
        try{
          if(!navigator.mediaDevices?.getUserMedia) return;
          const devices=await navigator.mediaDevices.enumerateDevices();
          const hasInput=devices.some(d=>d.kind==='audioinput');
          if(!hasInput){
            setTimeout(()=>{
              const s=document.getElementById('ram-call-status');
              if(s) s.textContent='Microphone device nahi mila. Windows/Chrome me microphone connect karke Retry karein.';
            },150);
          }
        }catch(e){
          console.warn('Audio device check:',e);
        }
      },true);
    });
  }
  bind();
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
})();
