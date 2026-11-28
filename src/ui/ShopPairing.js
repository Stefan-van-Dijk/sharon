import {openNotesDeck} from './NotesDeck.js?v=0.5.27';
import {mountShopApp} from './ShopApp.js?v=0.5.27';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.5.27';
import {wrapBoardSurface} from './BoardChrome.js?v=0.5.27';
import {bindBoardDeckGestures} from './BoardDeckGestures.js?v=0.5.27';
import {SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.5.27';
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
export function openAppIntroBoard({title,tagline,description,layoutStore,layoutKey,onTap,onClose=()=>{}}){
 const document=globalThis.document;
 const previous=document.activeElement;
 const dialog=document.createElement('dialog');
 dialog.className='sh-card-share-overlay sh-shop-access'+(title==='Event Line'?' sh-eventline-access':'');
 dialog.setAttribute('aria-label',title);
 const surface=document.createElement('section');
 surface.className='sh-share-board sh-notes-board sh-shop-access-board';
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
 header.append(heading,intro);
 for(const [kind,label] of [['board','Hoogte van board aanpassen'],['media','Hoogte van afbeelding en informatie aanpassen']]){
  const resize=document.createElement('button');
  resize.type='button';resize.className='sh-board-resizer';resize.dataset.deckSize=kind;
  resize.setAttribute('aria-label',label);header.append(resize);
 }
 const pill=document.createElement('button');
 pill.type='button';pill.className='sh-card-deck-grab sh-board-compass';pill.dataset.deckGrab='';
 pill.textContent='Verbind '+title;
 header.append(pill);
 const content=document.createElement('div');
 content.className='sh-share-board-info sh-shop-access-content';
 const explanation=document.createElement('p');
 explanation.textContent=description;
 const details=document.createElement('div');
 const status=document.createElement('p');status.setAttribute('role','status');
 content.append(explanation,details,status);surface.append(header,content);
 let closed=false;
 const close=()=>{
  if(closed)return;
  closed=true;
  onClose();releaseHeader();gestures.dispose();dialog.remove();previous?.focus();
 };
 const releaseHeader=bindNotesBoard(dialog,header,close,{gestures:false});
 const gestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore,layoutKey,closeFromGrab:true});
 pill.onclick=async()=>{
  pill.disabled=true;status.textContent='';
  try{await onTap();}
  catch(error){if(!closed)status.textContent=error.message;}
  finally{pill.disabled=false;}
 };
 dialog.addEventListener('close',close,{once:true});
 document.body.append(dialog);dialog.showModal();surface.focus({preventScroll:true});
 return {close,pill,details,status};
}

// Only the expiring invitation is copied to the clipboard.
export function openShopPairing(connection,{layoutStore=connection.store,onConnected=()=>{},onLogin,onOpen}={}){
 const document=globalThis.document;
 const request=async(action,input={})=>connection.request('shop-pair-'+action,input,await connection.device());
 let invitation=null,devices=[],polling=false,closed=false,wasActive=false;
 const onVisible=()=>{if(!document.hidden)refresh().catch(()=>{});};
 const timer=onLogin?null:setInterval(()=>{if(devices.some(device=>device.status!=='active'))onVisible();},5000);
 const board=openAppIntroBoard({
  title:'ShopList',tagline:'Boodschappenlijsten en categorieën in Sharon.',
  description:'Met je Sharon-account kun je vanuit Sharon je boodschappenlijsten openen en aanvullen. Tik op de pil voor een tijdelijke koppelcode. Open daarna ShopList, tik op het Sharon-logo en kies Koppelen met Sharon.',
  layoutStore,layoutKey:'apps.shoplist.board.layout',onTap:connect,
  onClose:()=>{closed=true;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);}
 });
 if(onLogin)board.pill.textContent='Inloggen bij Sharon';
 else{
  document.addEventListener('visibilitychange',onVisible);
  refresh().catch(error=>{if(!closed)board.status.textContent=error.message;});
 }
 return board.close;

 function claimedDevice(){return devices.find(device=>device.status==='claimed'&&!device.compact);}
 async function refresh(){
  if(polling||closed)return;
  polling=true;
  try{
   const result=await request('list');
   if(closed)return;
   devices=result.devices;
   const active=devices.some(device=>device.status==='active');
   const paired=devices.find(device=>device.id===invitation?.id);
   if(paired?.status==='active'){invitation=null;board.status.textContent='Koppeling geslaagd.';}
   else if(invitation?.expiresAt&&invitation.expiresAt<=Date.now())invitation=null;
   const claimed=claimedDevice();
   board.pill.textContent=active?'Open ShopList':claimed?'Bevestig koppeling':invitation?'Kopieer code':'Verbind ShopList';
   const detail=claimed?'Controlecode '+claimed.fingerprint+'. Bevestig via de pil als deze overeenkomt met de code in ShopList.'
    :paired?.status==='ready'?'ShopList rondt het opslaan van de koppeling af.'
    :invitation?'Tijdelijke koppelcode: '+invitation.code:'';
   if(board.details.textContent!==detail)board.details.textContent=detail;
   if(active&&!wasActive)onConnected();
   wasActive=active;
  }finally{polling=false;}
 }
 async function connect(){
  if(onLogin){onLogin();return;}
  if(wasActive){board.close();if(onOpen)onOpen();else openShopListFullscreen(connection.store,layoutStore);return;}
  const claimed=claimedDevice();
  if(claimed){
   await request('confirm',{id:claimed.id,fingerprint:claimed.fingerprint});
   await refresh();
   return;
  }
  if(invitation?.expiresAt&&invitation.expiresAt<=Date.now())invitation=null;
  const result=invitation?Promise.resolve(invitation):request('create',{format:'compact'});
  const code=result.then(value=>value.code);
  let copied;
  try{
   copied=typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write
    ?navigator.clipboard.write([new ClipboardItem({'text/plain':code.then(value=>new Blob([value],{type:'text/plain'}))})])
    :code.then(value=>navigator.clipboard.writeText(value));
  }catch(error){copied=Promise.reject(error);}
  const [issued,clipboard]=await Promise.allSettled([result,copied]);
  if(closed)return;
  if(issued.status==='rejected')throw issued.reason;
  invitation=issued.value;
  board.pill.textContent='Kopieer code';
  board.details.textContent='Tijdelijke koppelcode: '+invitation.code;
  board.status.textContent=clipboard.status==='fulfilled'?'Code gekopieerd.':'Kopieer de getoonde code of tik opnieuw op de pil.';
  await refresh();
 }
}
