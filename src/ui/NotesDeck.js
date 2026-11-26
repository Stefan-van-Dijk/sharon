import {sharonLogo} from './Brand.js?v=0.5.10';
import {SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.5.10';
import {wrapBoardSurface} from './BoardChrome.js?v=0.5.10';
import {bindBoardDeckGestures} from './BoardDeckGestures.js?v=0.5.10';

// One selected record is mounted; navigation uses the current filtered overview.
export function openNotesDeck({items,id,store,render,onAppReturn=()=>{},onAppView=()=>{},initialFullscreen=false}){
 const document=globalThis.document,previous=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='sh-card-share-overlay sh-notes-deck';
 const surface=document.createElement('section');surface.className='sh-share-board sh-notes-board';surface.dataset.cardBoard='';surface.tabIndex=-1;
 const stack=wrapBoardSurface(dialog,surface);stack.classList.add('sh-share-zone-stack');
 let selected=id,closed=false,fullscreen=initialFullscreen,generation=0,gestures,beforeLeave=()=>true,cleanup=()=>{};
 const close=(force=false)=>{if(closed||(!force&&!beforeLeave()))return;closed=true;cleanup();generation++;gestures?.dispose();document.defaultView.removeEventListener('message',onShopReturn);dialog.remove();previous?.focus();};
 const navigate=direction=>{if(fullscreen||!beforeLeave())return;const list=items();if(!list.length){close();return;}const index=list.findIndex(r=>r.id===selected);selected=list[(Math.max(0,index)+direction+list.length)%list.length].id;draw();};
 const bind=()=>{gestures?.dispose();gestures=fullscreen?null:bindBoardDeckGestures(stack,{onSwipe:navigate,onClose:close,layoutStore:store,layoutKey:'notes.board.layout'});};
 const setFullscreen=(value,{confirmed=false}={})=>{if(!beforeLeave())return;const frame=surface.querySelector('iframe.sh-shop-app');if(fullscreen&&!value&&!confirmed&&frame?.dataset.returnReady==='true'){frame.contentWindow.postMessage({type:'shop:prepare-return'},new URL(SHOPLIST_URL).origin);return;}const returning=fullscreen&&!value;fullscreen=value;dialog.classList.toggle('is-fullscreen',value);bind();draw();if(returning)onAppReturn();};
 function draw(){
  const row=items().find(r=>r.id===selected);if(!row){close();return;}
  cleanup();cleanup=()=>{};const ticket=++generation;beforeLeave=()=>true;surface.replaceChildren();dialog.classList.remove('shop-controls-ready');surface.classList.toggle('is-shop-list',!!row.linked);dialog.setAttribute('aria-label',row.title);
  const header=document.createElement('header');header.className='sh-card-media sh-notes-media '+(row.linked?'sh-notes-brand':'sh-notes-heading');header.dataset.cardMedia='';
  if(row.linked){const brand=document.createElement('strong');brand.className='sh-notes-wordmark';brand.textContent='ShopList.';header.append(brand);}
  const title=document.createElement('h2');title.textContent=row.title;header.append(title);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='sh-notes-expand';toggle.dataset.notesFullscreen='';
  toggle.hidden=!!row.linked&&!fullscreen;if(fullscreen&&row.linked){toggle.innerHTML='<span aria-hidden="true">←</span>'+sharonLogo();}else toggle.textContent=fullscreen?'↙':'⛶';toggle.setAttribute('aria-label',fullscreen?'Terug naar boards':'Open volledig scherm');toggle.onclick=()=>setFullscreen(!fullscreen);header.append(toggle);
  if(row.linked){const source=document.createElement('button');source.type='button';source.onclick=()=>setFullscreen(true);source.className='sh-notes-app-source';source.setAttribute('aria-label','Open deze lijst in ShopList');source.hidden=fullscreen;source.textContent='Open ShopList';header.append(source);}
 for(const [kind,label] of [['board','Hoogte van board aanpassen'],['media','Hoogte van afbeelding en informatie aanpassen']]){const resize=document.createElement('button');resize.type='button';resize.className='sh-board-resizer';resize.dataset.deckSize=kind;resize.setAttribute('aria-label',label);resize.hidden=fullscreen;header.append(resize);}
  const grab=document.createElement('button');grab.type='button';grab.className='sh-card-deck-grab';grab.dataset.deckGrab='';grab.textContent=row.title;grab.setAttribute('aria-label','Boards oppakken en verplaatsen');grab.hidden=fullscreen;
  const body=document.createElement('div');body.className='sh-notes-body';header.append(grab);surface.append(header,body);
  const current=()=>!closed&&ticket===generation&&body.isConnected;
  Promise.resolve(render(row,{body,dialog,title,fullscreen,openApp:()=>setFullscreen(true),isCurrent:current,setBeforeLeave:fn=>{if(current())beforeLeave=fn;},setCleanup:fn=>{if(current())cleanup=fn;else fn();}})).catch(error=>{if(current())body.textContent=error.message;});
 }
 const onShopReturn=event=>{
  const frame=surface.querySelector('iframe.sh-shop-app');
  if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(SHOPLIST_URL).origin)return;
  if(event.data?.type==='shop:return')setFullscreen(false,{confirmed:true});
  else if(event.data?.type==='shop:return-ready'){frame.dataset.returnReady='true';dialog.classList.add('shop-controls-ready');}
  else if(event.data?.type==='shop:view'&&['collect','check'].includes(event.data.view)){const row=items().find(r=>r.id===selected);if(row)onAppView(row,event.data.view);}
 };
 document.defaultView.addEventListener('message',onShopReturn);
 dialog.addEventListener('close',()=>close());dialog.addEventListener('cancel',event=>{event.preventDefault();if(fullscreen)setFullscreen(false);else close();});
 dialog.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,button'))return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigate(event.key==='ArrowRight'?1:-1);}});
 dialog.classList.toggle('is-fullscreen',fullscreen);document.body.append(dialog);bind();draw();dialog.showModal();surface.focus();
 return ()=>close(true);
}
