import {openShopCatalog} from './ShopCatalog.js?v=0.5.21';
import {openNotesDeck} from './NotesDeck.js?v=0.5.21';
import {mountShopApp} from './ShopApp.js?v=0.5.21';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.5.21';
import {wrapBoardSurface} from './BoardChrome.js?v=0.5.21';
import {bindBoardDeckGestures} from './BoardDeckGestures.js?v=0.5.21';
import {SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.5.21';
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
// No permanent credential leaves Sharon. Only an expiring invitation is copied.
export function openShopPairing(connection,{layoutStore=connection.store,onConnected=()=>{}}={}){
 const document=globalThis.document;
 const dialog=document.createElement('dialog');dialog.className='sh-card-share-overlay sh-shop-access';dialog.setAttribute('aria-label','Shop verbinden');
 const surface=document.createElement('section');surface.className='sh-share-board sh-notes-board sh-shop-access-board';surface.dataset.cardBoard='';
 const stack=wrapBoardSurface(dialog,surface);stack.classList.add('sh-share-zone-stack');
 const heading=document.createElement('h2');heading.textContent='ShopList.';
 const intro=document.createElement('p');intro.className='sh-shop-invitation';intro.textContent='Boodschappenlijsten en categorieën in Sharon.';
 const actions=document.createElement('div');actions.className='sh-shop-access-actions';
 const catalog=document.createElement('button');catalog.type='button';catalog.hidden=true;catalog.textContent='Catalogus en delen';catalog.onclick=()=>{close();openShopCatalog({store:connection.store});};actions.append(catalog);
 const open=document.createElement('button');open.type='button';open.hidden=true;open.textContent='Open ShopList';open.onclick=()=>{close();openNotesDeck({items:()=>[{id:'shop-app',title:'ShopList',linked:true}],id:'shop-app',store:layoutStore,initialFullscreen:true,render:(_, {body,setCleanup})=>mountShopApp(body,null,{api:new ShopListService(connection.store),registerCleanup:setCleanup})});};
 const install=document.createElement('a');install.href=SHOPLIST_URL+'?install=1';install.target='_blank';install.rel='noopener';install.textContent='Zet ShopList op je beginscherm';actions.append(open,install);
 const body=document.createElement('div');body.className='sh-notes-body';const status=document.createElement('p');status.setAttribute('role','status');
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};return b;};
 const request=async(action,input={})=>connection.request('shop-pair-'+action,input,await connection.device());
 let releaseBoard=()=>{};const previous=document.activeElement;let signature=null,invitation=null,devices=[],hasPending=false,creating=false;let closed=false,polling=false;const onVisible=()=>{if(!document.hidden)refresh().catch(()=>{});};const timer=setInterval(()=>{if(hasPending&&!document.hidden)refresh().catch(()=>{});},5000);document.addEventListener('visibilitychange',onVisible);const close=()=>{if(closed)return;closed=true;releaseBoard();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);dialog.remove();previous?.focus();};dialog.addEventListener('close',close,{once:true});
 const showCode=r=>{const code=document.createElement('input');code.value=r.code;code.readOnly=true;code.setAttribute('aria-label','Tijdelijke koppelcode');body.append(code,button('Kopieer code',async()=>{await navigator.clipboard.writeText(r.code);status.textContent='Open ShopList. Tik op het Sharon-logo en kies Koppelen met Sharon.';}));status.textContent='Zeven dagen geldig, tot Shop de koppeling succesvol heeft opgeslagen.';};
 const refresh=async()=>{if(polling||closed)return;polling=true;let result;try{result=await request('list');}finally{polling=false;}if(closed)return;devices=result.devices;hasPending=devices.some(d=>d.status!=='active');const next=JSON.stringify([devices,invitation?.id]);if(next===signature)return;signature=next;status.textContent='';body.replaceChildren();
  const active=devices.some(d=>d.status==='active');
  catalog.hidden=open.hidden=!active;
  install.hidden=active;
  if(active)onConnected();
  grab.textContent=active?'ShopList verbonden':'ShopList verbinden';

  const create=button(active?'Andere installatie koppelen':hasPending?'Nieuwe koppelcode maken':'Koppelcode maken',createInvitation);create.dataset.pairCreate='';create.disabled=creating;body.append(create);

  if(invitation&&result.devices.some(d=>d.id===invitation.id&&d.status!=='active')&&(!invitation.expiresAt||invitation.expiresAt>Date.now()))showCode(invitation);else {if(invitation&&result.devices.some(d=>d.id===invitation.id&&d.status==='active'))status.textContent='Koppeling geslaagd: Shop heeft de verbinding opgeslagen.';invitation=null;}
  for(const r of result.devices){const row=document.createElement('div');const text=document.createElement('p');text.textContent=r.status==='active'?'Shop verbonden · '+r.fingerprint:r.status==='ready'?'Shop rondt het opslaan van de koppeling af':r.status==='claimed'?'Controlecode '+r.fingerprint+' — komt deze overeen met Shop?':'Wacht op koppelen in Shop';row.append(text);
   if(r.status==='claimed'&&!r.compact)row.append(button('Ja, deze Shop verbinden',async()=>{await request('confirm',{id:r.id,fingerprint:r.fingerprint});status.textContent='Verbonden. Klik in Shop op Verbinding controleren.';await refresh();}));
   row.append(button(r.status==='active'?'Verbinding intrekken':'Annuleren',async()=>{await request('revoke',{id:r.id});await refresh();}));body.append(row);
  }
 };
 const header=document.createElement('header');header.className='sh-share-fixed sh-card-media sh-notes-brand';header.append(heading,intro);
 for(const [kind,label] of [['board','Hoogte van board aanpassen'],['media','Hoogte van afbeelding en informatie aanpassen']]){const resize=document.createElement('button');resize.type='button';resize.className='sh-board-resizer';resize.dataset.deckSize=kind;resize.setAttribute('aria-label',label);header.append(resize);}
 const grab=document.createElement('button');grab.type='button';grab.className='sh-card-deck-grab sh-board-compass';grab.dataset.deckGrab='';grab.textContent='ShopList verbinden';grab.setAttribute('aria-label','Boards oppakken en verplaatsen');header.append(grab);
 const content=document.createElement('div');content.className='sh-share-board-info sh-shop-access-content';content.append(actions,body,status,button('Vernieuwen',refresh));surface.append(header,content);document.body.append(dialog);
 const releaseHeader=bindNotesBoard(dialog,header,close,{gestures:false});const deckGestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore,layoutKey:'apps.shoplist.board.layout'});releaseBoard=()=>{releaseHeader();deckGestures.dispose();};dialog.showModal();surface.tabIndex=-1;surface.focus({preventScroll:true});
 // Opening this board only reads status. Creating an invitation is an explicit action.
 refresh().catch(e=>{if(!closed)status.textContent='Verbindingsstatus kon niet worden opgehaald. '+e.message;});return close;
 function createInvitation(){
  if(creating||closed)return;creating=true;
  const code=request('create',{format:'compact'}).then(r=>{if(!closed)invitation=r;return r.code;});
  let copied;
  try{copied=typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write?navigator.clipboard.write([new ClipboardItem({'text/plain':code.then(value=>new Blob([value],{type:'text/plain'}))})]):code.then(value=>navigator.clipboard.writeText(value));}catch(e){copied=Promise.reject(e);}
  return Promise.allSettled([code,copied]).then(async results=>{if(closed)return;signature=null;await refresh();if(results[0].status==='rejected')status.textContent=results[0].reason.message;else if(invitation)status.textContent=results[1].status==='fulfilled'?'Open ShopList. Tik op het Sharon-logo en kies Koppelen met Sharon.':'Tik op Kopieer code. Open daarna ShopList, tik op het Sharon-logo en kies Koppelen met Sharon.';}).finally(()=>{creating=false;const control=body.querySelector('[data-pair-create]');if(control)control.disabled=false;});
 }
}
