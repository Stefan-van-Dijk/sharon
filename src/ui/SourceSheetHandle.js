export function mountSourceSheetHandle(sheet,selector,onClose){
  const handle=sheet?.querySelector(selector);if(!handle)return ()=>{};
  const listeners=[];let start=null,delta=0,suppressClick=false;
  const listen=(node,name,fn,options)=>{node.addEventListener(name,fn,options);listeners.push(()=>node.removeEventListener(name,fn,options));};
  const begin=y=>{start=y;delta=0;suppressClick=false;};
  const move=y=>{if(start===null)return;delta=Math.max(0,y-start);sheet.style.transform='translateY('+delta+'px)';};
  const end=cancel=>{if(start===null)return;suppressClick=delta>6?Date.now()+400:0;const close=!cancel&&delta>=40;start=null;delta=0;sheet.style.transform='';if(close)onClose();};
  if(typeof window.PointerEvent==='function'){
    listen(handle,'pointerdown',event=>{if(event.button!==0)return;begin(event.clientY);handle.setPointerCapture?.(event.pointerId);});
    listen(handle,'pointermove',event=>move(event.clientY));
    listen(handle,'pointerup',()=>end(false));listen(handle,'pointercancel',()=>end(true));
  }else{
    listen(handle,'touchstart',event=>{if(event.touches.length===1)begin(event.touches[0].clientY);},{passive:true});
    listen(handle,'touchmove',event=>{if(start!==null&&event.touches[0]){event.preventDefault();move(event.touches[0].clientY);}},{passive:false});
    listen(handle,'touchend',event=>{if(event.changedTouches[0])move(event.changedTouches[0].clientY);end(false);},{passive:true});listen(handle,'touchcancel',()=>end(true),{passive:true});
  }
  listen(handle,'click',event=>{if(Date.now()<suppressClick){suppressClick=0;event.preventDefault();return;}onClose();});
  return ()=>{listeners.forEach(off=>off());sheet.style.transform='';};
}
