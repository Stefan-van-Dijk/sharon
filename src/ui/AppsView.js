import {EVENT_LINE_URL,eventLineConnected,setEventLineConnected} from '../core/events/EventLineSource.js?v=0.5.24';
import {moduleIcon,homeModules,homeOrder} from './ModuleIcons.js?v=0.5.24';
import {bindNotesBoard,openShopPairing,openShopListFullscreen} from './ShopPairing.js?v=0.5.24';
import {sharonLogo} from './Brand.js?v=0.5.24';
import {renderObjectStrip} from './ObjectStrip.js?v=0.5.24';
import {bindSwipeRows} from './SwipeRows.js?v=0.5.24';
import {ConnectionService} from '../core/connection/ConnectionService.js?v=0.5.24';

// Home visibility changes only navigation; module data and app grants stay intact.
export function openAppsView(outlet,{settings,store,items,onChanged=()=>{},connection=new ConnectionService(store)}){
 const document=outlet.ownerDocument,known=new Map(items.map(item=>[item.id,item]));
 let selected=homeModules(settings.get(),items.map(item=>item.id));
 let order=homeOrder(settings.get(),items.map(item=>item.id));
 let mode='home',busy=false,disposed=false,dragged=null,closePairing=()=>{},unbindApps=()=>{};
 let eventConnected=false,shopConnected=false,disconnecting=false,refreshId=0;
 const root=document.createElement('section');root.className='sh-apps-view module-view';
 const tabs=document.createElement('div');tabs.className='sh-apps-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Apps en onderdelen');
 const panel=document.createElement('div');panel.className='sh-apps-panel';
 const status=document.createElement('p');status.setAttribute('role','status');
 const button=(label,fn)=>{const element=document.createElement('button');element.type='button';element.textContent=label;element.onclick=fn;return element;};
 for(const [id,label] of [['home','Mijn Sharon'],['apps','Apps verbinden']]){const tab=button(label,()=>{mode=id;paint();if(id==='apps')refreshApps();});tab.dataset.appsTab=id;tabs.append(tab);}
 root.append(tabs,panel,status);outlet.replaceChildren(root);
 async function save(next,nextOrder=order){
  if(busy||disposed)return false;
  busy=true;status.textContent='';paint();
  try{
   next=nextOrder.filter(id=>next.includes(id));
   await settings.update({home:{modules:next,order:nextOrder}});
   selected=[...next];order=[...nextOrder];if(!disposed)onChanged([...selected]);return true;
  }catch(error){if(!disposed)status.textContent=error.message||'Je keuze kon niet worden bewaard.';return false;}
  finally{busy=false;if(!disposed)paint();}
 }
 function move(id,target){
  const from=order.indexOf(id);if(from<0||target<0||target>=order.length||from===target)return;
  const next=[...order];next.splice(from,1);next.splice(target,0,id);save(selected,next);
 }
 const shopRequest=async(action,input)=>connection.request('shop-pair-'+action,input,await connection.device());
 async function refreshApps(){
  const current=++refreshId;
  const [event,shop]=await Promise.allSettled([eventLineConnected(store),shopRequest('list',{})]);
  if(disposed||current!==refreshId)return;
  eventConnected=event.status==='fulfilled'&&event.value;
  shopConnected=shop.status==='fulfilled'&&Array.isArray(shop.value?.devices)&&shop.value.devices.some(device=>device.status==='active');
  if(mode==='apps')paint();
 }
 function openEventLine(){
  closePairing();
  const previous=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='sh-external-app-fullscreen';
  dialog.setAttribute('aria-label','Event Line');
  const view=document.defaultView;
  const frame=document.createElement('iframe');
  const url=new URL(EVENT_LINE_URL);
  url.searchParams.set('from','sharon');
  frame.src=url.href;frame.title='Event Line';frame.className='sh-eventline-frame';
  frame.referrerPolicy='origin';
  const close=()=>{
   view.removeEventListener('message',receive);
   if(dialog.isConnected){dialog.remove();previous?.focus();}
  };
  const back=button('',close);
  back.className='sh-external-app-return';
  back.setAttribute('aria-label','Terug naar Sharon');
  back.innerHTML=sharonLogo();
  const receive=event=>{
   if(event.source!==frame.contentWindow||event.origin!==url.origin)return;
   if(event.data?.type==='eventline:return-ready')back.hidden=true;
   if(event.data?.type==='eventline:return')close();
  };
  view.addEventListener('message',receive);
  dialog.append(frame,back);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',close,{once:true});
  closePairing=close;dialog.showModal();back.focus();
 }
 async function disconnectApp(id){
  if(disconnecting)return;
  const shop=id==='shoplist';
  if(!document.defaultView.confirm(shop?'Alle ShopList-installaties ontkoppelen?':'Event Line ontkoppelen?'))return;
  disconnecting=true;status.textContent='';
  try{
   if(shop){
    const {devices}=await shopRequest('list',{});
    for(const device of devices)await shopRequest('revoke',{id:device.id});
   }else await setEventLineConnected(store,false);
  }catch(error){status.textContent=error.message;}
  finally{await refreshApps();disconnecting=false;}
 }
 function openEventLineBoard(){
  closePairing();
  const previous=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='sh-notes-board';
  dialog.setAttribute('aria-label','Event Line');
  const header=document.createElement('header');header.className='sh-notes-heading';
  const title=document.createElement('h2');title.textContent='Event Line';header.append(title);
  const body=document.createElement('div');body.className='sh-notes-body';
  const intro=document.createElement('p');intro.textContent='Bewaar openbare evenementen in je agenda.';
  const actions=document.createElement('div');
  const feedback=document.createElement('p');feedback.setAttribute('role','status');
  const close=()=>{if(!dialog.isConnected)return;release();dialog.remove();previous?.focus();};
  const release=bindNotesBoard(dialog,header,close);
  const choose=async connected=>{
   for(const control of actions.children)control.disabled=true;
   try{
    await setEventLineConnected(store,connected);
    if(connected && !selected.includes('agenda') && known.has('agenda'))await save([...selected,'agenda']);
    refreshApps();
    eventConnected=connected;
    if(mode==='apps')paint();
    if(dialog.isConnected)render(connected);
   }catch(error){
    feedback.textContent=error.message;
    for(const control of actions.children)control.disabled=false;
   }
  };
  const render=connected=>{
   actions.replaceChildren(connected
    ? button('Open Event Line',openEventLine)
    : button('Verbind Event Line',()=>choose(true)));
  };
  body.append(intro,actions,feedback,button('Sluiten',close));dialog.append(header,body);
  dialog.addEventListener('close',close,{once:true});
  closePairing=close;document.body.append(dialog);dialog.showModal();
  eventLineConnected(store).then(render,error=>{feedback.textContent=error.message;});
 }
 function paint(){
  if(disposed)return;
  unbindApps();
  tabs.querySelectorAll('button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.appsTab===mode)));
  panel.replaceChildren();
  if(mode==='apps'){
   const rows=document.createElement('div');rows.className='swipe-list sh-connected-apps';
   for(const [id,title,icon,color,connected] of [
    ['shoplist','ShopList','notes','#a44932',shopConnected],
    ['eventline','Event Line','agenda','#574493',eventConnected]
   ]){
    const action=connected?'Verbonden · Open app':'Verbinden';
    rows.insertAdjacentHTML('beforeend',renderObjectStrip({
     id,title,subtitle:action,ariaLabel:title+' · '+action,
     className:'sh-connected-app sh-connected-app--'+id,
     iconHtml:moduleIcon(icon),accentColor:color,
     trailingHtml:'<span class="sh-app-launch-icon" aria-hidden="true">'+(connected?'↗':'+')+'</span>',
     actions:connected?[{kind:'delete',label:'Deactiveren'}]:[],singleAction:true
    }));
   }
   panel.append(rows);
   unbindApps=bindSwipeRows(rows,{
    onOpen:id=>{
     if(disconnecting)return;
     if(id==='eventline'){if(eventConnected)openEventLine();else openEventLineBoard();return;}
     closePairing();
     if(shopConnected){closePairing=openShopListFullscreen(store);return;}
     closePairing=openShopPairing(connection,{layoutStore:store,onConnected:()=>{
      shopConnected=true;
      if(!selected.includes('notes')&&known.has('notes'))save([...selected,'notes']);
      else if(mode==='apps')paint();
     }});
    },
    onDelete:disconnectApp
   });
   return;
  }
  const hint=document.createElement('p');hint.className='sh-apps-hint';hint.textContent='Kies je onderdelen. Sleep onderdelen met het handvat in jouw volgorde.';panel.append(hint);
  const ordered=order;
  for(const id of ordered){
   const item=known.get(id),enabled=selected.includes(id),row=document.createElement('div');row.className='sh-apps-module-row';row.dataset.moduleChoice=id;
   const toggle=button('',()=>save(enabled?selected.filter(value=>value!==id):[...selected,id]));toggle.className='sh-apps-module-toggle';toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(enabled));toggle.setAttribute('aria-label',item.title);toggle.disabled=busy;
   const icon=document.createElement('span');icon.className='sh-module-icon';icon.innerHTML=moduleIcon(id);const title=document.createElement('span');title.textContent=item.title;const mark=document.createElement('span');mark.className='sh-apps-switch';mark.setAttribute('aria-hidden','true');toggle.append(icon,title,mark);row.append(toggle);
   const handle=button('',()=>{});handle.className='sh-apps-drag-handle';handle.dataset.moduleHandle=id;handle.disabled=busy;handle.setAttribute('aria-label',item.title+' verplaatsen');
   handle.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';
   handle.addEventListener('keydown',event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();move(id,order.indexOf(id)+(event.key==='ArrowUp'?-1:1));}});
   let target=id;
   handle.addEventListener('pointerdown',event=>{if(busy||event.button>0)return;dragged=id;target=id;handle.setPointerCapture?.(event.pointerId);row.classList.add('is-dragging');event.preventDefault();});
   handle.addEventListener('pointermove',event=>{if(dragged!==id)return;const hit=document.elementFromPoint?.(event.clientX,event.clientY)?.closest('[data-module-choice]');if(!hit||!panel.contains(hit))return;target=hit.dataset.moduleChoice;panel.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));hit.classList.add('is-drop-target');});
   const end=event=>{if(dragged!==id)return;dragged=null;row.classList.remove('is-dragging');panel.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));if(event.type==='pointerup')move(id,order.indexOf(target));};
   handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);row.append(handle);
   panel.append(row);
  }
 }
 paint();return ()=>{disposed=true;dragged=null;unbindApps();closePairing();};
}
