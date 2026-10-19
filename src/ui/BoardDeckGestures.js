// Swipe the front board; hold the grab area to lift and move the complete stack.
export function bindBoardDeckGestures(board, stack, grab, {onSwipe,onExpand,onCollapse,layoutStore}={}) {
  let gesture=null,closed=false,suppressClick=false,interacted=false;
  let position={x:0,y:0};
  const key='cards.board.layout';
  const apply=()=>{
    stack.style.setProperty('--card-deck-x',position.x+'px');
    stack.style.setProperty('--card-deck-y',position.y+'px');
  };
  const clamp=()=>{
    const rect=stack.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const base={left:rect.left-position.x,right:rect.right-position.x,top:rect.top-position.y,bottom:rect.bottom-position.y};
    position.x=Math.max(8-base.left,Math.min(window.innerWidth-8-base.right,position.x));
    position.y=Math.max(8-base.top,Math.min(window.innerHeight-8-base.bottom,position.y));apply();
  };
  layoutStore?.get('meta',key).then(record=>{
    if(closed||interacted)return;
    const value=record?.value;
    if(Number.isFinite(value?.x)&&Number.isFinite(value?.y)){
      position={x:value.x*window.innerWidth,y:value.y*window.innerHeight};apply();clamp();
    }
  }).catch(()=>{});
  const save=()=>layoutStore?.put('meta',{key,value:{x:position.x/window.innerWidth,y:position.y/window.innerHeight}}).catch(()=>{});
  const end=()=>{
    if(!gesture)return;
    clearTimeout(gesture.timer);
    try {gesture.target.releasePointerCapture?.(gesture.id);}catch{}
    gesture=null;
    stack.classList.remove('is-card-deck-lifted');board.classList.remove('is-card-deck-swiping');
    board.style.removeProperty('transform');grab.setAttribute('aria-pressed','false');
  };
  const down=event=>{
    if(gesture || (event.button!==undefined&&event.button!==0))return;
    const isGrab=Boolean(event.target.closest('[data-deck-grab]'));
    if(!isGrab&&event.target.closest('button,a,input,textarea,select'))return;
    interacted=true;
    gesture={id:event.pointerId,target:event.target,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,mode:'pending',isGrab,start:{...position},timer:null};
    try {event.target.setPointerCapture?.(event.pointerId);}catch{}
    if(isGrab){
      event.preventDefault();
      const current=gesture;
      current.timer=setTimeout(()=>{
        if(gesture!==current)return;
        current.mode='move';current.x=current.lastX;current.y=current.lastY;current.start={...position};
        stack.classList.add('is-card-deck-lifted');grab.setAttribute('aria-pressed','true');
      },450);
    }
  };
  const move=event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    gesture.lastX=event.clientX;gesture.lastY=event.clientY;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(gesture.mode==='move'){
      event.preventDefault();position={x:gesture.start.x+dx,y:gesture.start.y+dy};apply();clamp();return;
    }
    if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
    clearTimeout(gesture.timer);
    if(gesture.mode==='pending')gesture.mode=Math.abs(dx)>Math.abs(dy)*1.2?'swipe':'vertical';
    if(gesture.mode==='swipe'){
      event.preventDefault();board.classList.add('is-card-deck-swiping');
      board.style.transform=`translateX(${dx*.4}px) rotate(${Math.max(-2,Math.min(2,dx/100))}deg)`;
    }else if(gesture.target.closest('[data-card-media],[data-deck-grab]'))event.preventDefault();
  };
  const up=event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const current=gesture,dx=event.clientX-current.x,dy=event.clientY-current.y;
    const mode=current.mode,fromMedia=Boolean(current.target.closest('[data-card-media],[data-deck-grab]'));
    end();
    if(mode==='move'){save();suppressClick=true;}
    else if(mode==='swipe'&&Math.abs(dx)>45){onSwipe?.(dx<0?1:-1);suppressClick=true;}
    else if(fromMedia&&Math.abs(dy)>45&&Math.abs(dy)>Math.abs(dx)*1.2){if(dy<0)onExpand?.();else onCollapse?.();suppressClick=true;}
    if(suppressClick)setTimeout(()=>{suppressClick=false;},100);
  };
  const cancel=()=>{if(gesture?.mode==='move'){position=gesture.start;apply();}end();};
  const click=event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}};
  const resize=()=>clamp();
  board.addEventListener('pointerdown',down);board.addEventListener('pointermove',move,{passive:false});
  board.addEventListener('pointerup',up);board.addEventListener('pointercancel',cancel);
  grab.addEventListener('click',click,true);window.addEventListener('resize',resize);
  return {refresh:()=>requestAnimationFrame(()=>{if(!closed)clamp();}),dispose:()=>{
    closed=true;cancel();board.removeEventListener('pointerdown',down);board.removeEventListener('pointermove',move);
    board.removeEventListener('pointerup',up);board.removeEventListener('pointercancel',cancel);
    grab.removeEventListener('click',click,true);window.removeEventListener('resize',resize);
  }};
}
