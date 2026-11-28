import {openNotesDeck} from './NotesDeck.js?v=0.5.30';
import {mountShopApp} from './ShopApp.js?v=0.5.30';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.5.30';
import {wrapBoardSurface} from './BoardChrome.js?v=0.5.30';
import {bindBoardDeckGestures} from './BoardDeckGestures.js?v=0.5.30';
import {SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.5.30';
// Reuse the board's pull-down gesture, leaving scrolling and links native.
export function bindNotesBoard(dialog,header,close,{shop=false,onOpen,gestures:enableGestures=true}={}){
 dialog.setAttribute('data-card-board','');header.setAttribute('data-card-media','');
 header.classList.add('sh-notes-board-top');
 if(shop){
  const link=dialog.ownerDocument.createElement(onOpen?'button':'a');
  if(onOpen){link.type='button';link.onclick=onOpen;}else{link.href=SHOPLIST_URL;link.target='_blank';link.rel='noopener noreferrer';}
  link.className='sh-board-source sh-board-photo-source sh-notes-app-source';link.setAttribute('aria-label',onOpen?'Open deze lijst in Sharon':'Open ShopList');link.title=onOpen?'Open deze lijst in Sharon':'Open ShopList';
  link.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="m8 9 2 2 4-4m-6 9 2 2 4-4"/></svg>';header.append(link);
 }
 const gestures=enableGestures?bindBoardDeckGestures(dialog,{onClose:close}):null;
 const cancel=event=>{event.preventDefault();close();};dialog.addEventListener('cancel',cancel);
 return ()=>{gestures?.dispose();dialog.removeEventListener('cancel',cancel);};
}
export function openShopListFullscreen(store, layoutStore=store){
 return openNotesDeck({items:()=>[{id:'shop-app',title:'ShopList',linked:true}],id:'shop-app',
  store:layoutStore,initialFullscreen:true,closeOnAppReturn:true,
  render:(_, {body,setCleanup})=>mountShopApp(body,null,{
   api:new ShopListService(store),registerCleanup:setCleanup
  })});
}
export function openAppIntroBoard({title,tagline,description,iconHtml,layoutStore,layoutKey,onTap,onOpen,onSwipe}){
 const document=globalThis.document;
 const previous=document.activeElement;
 const dialog=document.createElement('dialog');
 dialog.className='sh-card-share-overlay sh-shop-access'+(iconHtml?' sh-account-extra-board':title==='Event Line'?' sh-eventline-access':'');
 dialog.setAttribute('aria-label',title);
 const surface=document.createElement('section');
 surface.className='sh-share-board sh-notes-board sh-shop-access-board';
 surface.dataset.cardBoard='';
 surface.tabIndex=-1;
 const stack=wrapBoardSurface(dialog,surface);
 stack.classList.add('sh-share-zone-stack');
 const header=document.createElement('header');
 header.className='sh-share-fixed sh-card-media sh-notes-brand';
 const heading=document.createElement('h2');
 heading.textContent=title==='ShopList'?'ShopList.':title;
 const intro=document.createElement('p');
 intro.className='sh-shop-invitation';
 intro.textContent=tagline;
 if(iconHtml){
  const icon=document.createElement('span');
  icon.className='sh-account-extra-board-icon';
  icon.setAttribute('aria-hidden','true');
  icon.innerHTML=iconHtml;
  header.append(icon);
 }
 header.append(heading);
 if(tagline)header.append(intro);
 for(const [kind,label] of [['board','Hoogte van board aanpassen'],['media','Hoogte van afbeelding en informatie aanpassen']]){
  const resize=document.createElement('button');
  resize.type='button';resize.className='sh-board-resizer';resize.dataset.deckSize=kind;
  resize.setAttribute('aria-label',label);header.append(resize);
 }
 const pill=document.createElement('button');
 pill.type='button';pill.className='sh-card-deck-grab sh-board-compass';pill.dataset.deckGrab='';
 pill.textContent=onTap?'Verbind '+title:'Verplaatsen';
 header.append(pill);
 const source=document.createElement('button');
 source.type='button';
 source.className='sh-board-source sh-board-photo-source sh-notes-app-source';
 source.hidden=Boolean(onTap);
 source.title='Open '+title;
 source.setAttribute('aria-label',source.title);
 source.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 18 18 6M8 6h10v10"/></svg>';
 source.onclick=onOpen;
 if(onOpen)header.append(source);
 const content=document.createElement('div');
 content.className='sh-share-board-info sh-shop-access-content';
 const explanation=document.createElement('p');
 explanation.textContent=description;
 const status=document.createElement('p');status.setAttribute('role','status');
 content.append(explanation,status);surface.append(header,content);
 let closed=false;
 const close=()=>{
  if(closed)return;
  closed=true;
  releaseHeader();gestures.dispose();dialog.remove();previous?.focus();
 };
 const releaseHeader=bindNotesBoard(dialog,header,close,{gestures:false});
 dialog.removeAttribute('data-card-board');
 const gestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore,layoutKey,onSwipe,closeFromGrab:true});
 if(onTap)pill.onclick=async()=>{
  if(pill.getAttribute('aria-disabled')==='true')return;
  pill.disabled=true;status.textContent='';
  try{await onTap();}
  catch(error){if(!closed)status.textContent=error.message;}
  finally{pill.disabled=false;}
 };
 surface.addEventListener('keydown',event=>{
  if(event.target!==surface||!onSwipe)return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   event.preventDefault();onSwipe(event.key==='ArrowLeft'?1:-1);
  }
 });
 dialog.addEventListener('close',close,{once:true});
 document.body.append(dialog);dialog.showModal();surface.focus({preventScroll:true});
 return {close,pill,showConnected(){
  pill.textContent=title+' verbonden';
  pill.setAttribute('aria-disabled','true');
  source.hidden=false;
 }};
}
