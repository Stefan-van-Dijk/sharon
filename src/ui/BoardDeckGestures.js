// Swipe the pill right to gather the boards, then drag the collected deck.
export function bindBoardDeckGestures(stack,{onSwipe,onClose,layoutStore,layoutKey='cards.board.layout',onGrabTap,onGrabSearch}={}) {
  let gesture=null,closed=false,interacted=false,suppressGrabClickUntil=0;
  let layout={x:0,y:0,height:Math.min(580,window.innerHeight-112),media:Math.min(330,window.innerHeight*.34)};
  const key=layoutKey;
  const mobile=()=>window.innerWidth<760;
  const constrain=()=>{
    if(mobile())layout.x=0;
    const maxHeight=Math.max(180,window.innerHeight-112);
    layout.height=Math.max(Math.min(260,maxHeight),Math.min(maxHeight,layout.height));
    layout.media=Math.max(Math.min(190,layout.height-80),Math.min(layout.height-80,layout.media));
  };
  const apply=()=>{
    constrain();
    for(const [name,value] of Object.entries(layout))stack.style.setProperty('--card-deck-'+name,value+'px');
  };
  const clamp=()=>{
    const rect=stack.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    // Keep the grab pill reachable. Clamping the full-width board itself
    // leaves almost no horizontal travel on a phone.
    const grab=stack.querySelector('[data-card-board]:not([aria-hidden="true"]) [data-deck-grab]');
    const bounds=grab?.getBoundingClientRect();
    const anchor=bounds?.width?bounds:rect;
    const base={left:anchor.left-layout.x,right:anchor.right-layout.x,top:anchor.top-layout.y,bottom:anchor.bottom-layout.y};
    layout.x=mobile()?0:Math.max(8-base.left,Math.min(window.innerWidth-8-base.right,layout.x));
    layout.y=Math.max(28-base.top,Math.min(window.innerHeight-8-base.bottom,layout.y));apply();
  };
  const save=()=>layoutStore?.put('meta',{key,value:{x:layout.x/window.innerWidth,y:layout.y/window.innerHeight,height:layout.height/window.innerHeight,media:layout.media/window.innerHeight}}).catch(()=>{});
  layoutStore?.get('meta',key).then(record=>{
    if(closed||interacted)return;
    const value=record?.value;
    if(Number.isFinite(value?.x)&&Number.isFinite(value?.y)){
      layout.x=value.x*window.innerWidth;layout.y=value.y*window.innerHeight;
      if(Number.isFinite(value.height))layout.height=value.height*window.innerHeight;
      if(Number.isFinite(value.media))layout.media=value.media*window.innerHeight;
      apply();clamp();
    }
  }).catch(()=>{});
  const end=()=>{
    if(!gesture)return;
    const current=gesture;gesture=null;
    try{current.target.releasePointerCapture?.(current.id);}catch{}
    stack.classList.remove('is-card-deck-lifted');current.board.classList.remove('is-card-deck-swiping');
    current.board.style.removeProperty('transform');
    if(current.target.matches('[data-deck-grab]'))current.target.setAttribute('aria-pressed','false');
  };
  const down=event=>{
    if(gesture||(event.button!==undefined&&event.button!==0))return;
    const board=event.target.closest('[data-card-board]');
    if(!board||board.getAttribute('aria-hidden')==='true')return;
    const handle=event.target.closest('[data-deck-grab],[data-deck-size]');
    if(!handle&&event.target.closest('button,a,input,textarea,select'))return;
    interacted=true;
    const mode=handle?.matches('[data-deck-grab]')?'gather':handle?.dataset.deckSize||'pending';
    gesture={id:event.pointerId,target:handle||event.target,board,x:event.clientX,y:event.clientY,start:{...layout},mode};
    try{gesture.target.setPointerCapture?.(event.pointerId);}catch{}
    if(handle)event.preventDefault();
  };
  const move=event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(gesture.mode==='gather'){
      event.preventDefault();
      if(onGrabSearch&&dx < -22&&Math.abs(dx)>Math.abs(dy)*1.2){gesture.mode='search';return;}
      if(dx>22&&dx>Math.abs(dy)*1.2){
        gesture.mode='move';
        // Gathering consumes the swipe. Start dragging here without a jump.
        gesture.x=event.clientX;gesture.y=event.clientY;
        stack.classList.add('is-card-deck-lifted');gesture.target.setAttribute('aria-pressed','true');
      }
      return;
    }
    if(gesture.mode==='pending'&&Math.max(Math.abs(dx),Math.abs(dy))>=9)gesture.mode=Math.abs(dx)>Math.abs(dy)*1.2?'swipe':'vertical';
    if(gesture.mode==='move'){
      layout.x=mobile()?0:gesture.start.x+dx;layout.y=gesture.start.y+dy;apply();clamp();
    }else if(gesture.mode==='board'){
      // The flex-end anchor already keeps the bottom fixed when height changes.
      layout.height=gesture.start.height-dy;apply();clamp();
    }else if(gesture.mode==='media'){
      layout.media=gesture.start.media+dy;apply();
    }else if(gesture.mode==='swipe'){
      gesture.board.classList.add('is-card-deck-swiping');gesture.board.style.transform=`translateX(${dx*.4}px) rotate(${Math.max(-2,Math.min(2,dx/100))}deg)`;
    }
    if(gesture.mode!=='pending'&&(gesture.mode!=='vertical'||gesture.target.closest('[data-card-media]')))event.preventDefault();
  };
  const up=event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const current=gesture,dx=event.clientX-current.x,dy=event.clientY-current.y;end();
    if(['move','search'].includes(current.mode)||(current.mode==='gather'&&Math.max(Math.abs(dx),Math.abs(dy))>9))suppressGrabClickUntil=Date.now()+400;
    if(current.mode==='search'&&dx < -45&&Math.abs(dx)>Math.abs(dy)*1.2)onGrabSearch?.();
    else if(['move','board','media'].includes(current.mode))save();
    else if(current.mode==='swipe'&&Math.abs(dx)>45)onSwipe?.(dx<0?1:-1);
    else if(current.mode==='vertical'&&dy>70&&current.target.closest('[data-card-media]'))onClose?.();
  };
  const cancel=event=>{if(!gesture||(event&&event.pointerId!==gesture.id))return;layout={...gesture.start};apply();end();};
  const keydown=event=>{
    const target=event.target.closest('[data-deck-size],[data-deck-grab]');
    if(!target||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();interacted=true;
    const delta=['ArrowDown','ArrowRight'].includes(event.key)?16:-16;
    if(target.matches('[data-deck-grab]')){
      if(!mobile()||!['ArrowLeft','ArrowRight'].includes(event.key))layout[['ArrowLeft','ArrowRight'].includes(event.key)?'x':'y']+=delta;
    }
    else if(['ArrowUp','ArrowDown'].includes(event.key)){
      if(target.dataset.deckSize==='media')layout.media+=delta;
      else layout.height-=delta;
    }
    apply();clamp();save();
  };
  const grabClick=event=>{if(!event.target.closest('[data-deck-grab]'))return;if(Date.now()<suppressGrabClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}onGrabTap?.();};
  stack.addEventListener('click',grabClick,true);
  const resize=()=>{apply();clamp();};
  stack.addEventListener('pointerdown',down);stack.addEventListener('keydown',keydown);
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('resize',resize);
  apply();
  return {refresh:()=>requestAnimationFrame(()=>{if(!closed)clamp();}),dispose:()=>{
    closed=true;cancel();stack.removeEventListener('click',grabClick,true);stack.removeEventListener('pointerdown',down);stack.removeEventListener('keydown',keydown);
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('resize',resize);
  }};
}
