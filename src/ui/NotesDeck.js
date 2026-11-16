import {wrapBoardSurface} from './BoardChrome.js?v=0.4.87';
import {bindBoardDeckGestures} from './BoardDeckGestures.js?v=0.4.87';

// One selected record is mounted; navigation uses the current filtered overview.
export function openNotesDeck({items,id,store,render}){
 const document=globalThis.document,previous=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='sh-card-share-overlay sh-notes-deck';
 const surface=document.createElement('section');surface.className='sh-share-board sh-notes-board';surface.dataset.cardBoard='';surface.tabIndex=-1;
 const stack=wrapBoardSurface(dialog,surface);stack.classList.add('sh-share-zone-stack');
 let selected=id,closed=false,fullscreen=false,generation=0,gestures,beforeLeave=()=>true;
 const close=(force=false)=>{if(closed||(!force&&!beforeLeave()))return;closed=true;generation++;gestures?.dispose();dialog.remove();previous?.focus();};
 const navigate=direction=>{if(fullscreen||!beforeLeave())return;const list=items();if(!list.length){close();return;}const index=list.findIndex(r=>r.id===selected);selected=list[(Math.max(0,index)+direction+list.length)%list.length].id;draw();};
 const bind=()=>{gestures?.dispose();gestures=fullscreen?null:bindBoardDeckGestures(stack,{onSwipe:navigate,onClose:close,layoutStore:store,layoutKey:'notes.board.layout'});};
 const setFullscreen=value=>{if(!beforeLeave())return;fullscreen=value;dialog.classList.toggle('is-fullscreen',value);bind();draw();};
 function draw(){
  const row=items().find(r=>r.id===selected);if(!row){close();return;}
  const ticket=++generation;beforeLeave=()=>true;surface.replaceChildren();dialog.setAttribute('aria-label',row.title);
  const header=document.createElement('header');header.className=row.linked?'sh-notes-brand':'sh-notes-heading';header.dataset.cardMedia='';
  if(row.linked){const brand=document.createElement('strong');brand.className='sh-notes-wordmark';brand.textContent='ShopList.';header.append(brand);}
  const title=document.createElement('h2');title.textContent=row.title;header.append(title);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='sh-notes-app-source';toggle.dataset.notesFullscreen='';
  toggle.textContent=fullscreen?'↙':'⛶';toggle.setAttribute('aria-label',fullscreen?'Terug naar boards':'Open volledig scherm');toggle.onclick=()=>setFullscreen(!fullscreen);header.append(toggle);
  const grab=document.createElement('button');grab.type='button';grab.className='sh-card-deck-grab';grab.dataset.deckGrab='';grab.textContent=row.title;grab.setAttribute('aria-label','Boards oppakken en verplaatsen');grab.hidden=fullscreen;
  const body=document.createElement('div');body.className='sh-notes-body';surface.append(header,grab,body);
  const current=()=>!closed&&ticket===generation&&body.isConnected;
  Promise.resolve(render(row,{body,dialog,title,fullscreen,isCurrent:current,setBeforeLeave:fn=>{if(current())beforeLeave=fn;}})).catch(error=>{if(current())body.textContent=error.message;});
 }
 dialog.addEventListener('close',()=>close());dialog.addEventListener('cancel',event=>{event.preventDefault();if(fullscreen)setFullscreen(false);else close();});
 dialog.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,button'))return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigate(event.key==='ArrowRight'?1:-1);}});
 document.body.append(dialog);bind();draw();dialog.showModal();surface.focus();
 return ()=>close(true);
}
