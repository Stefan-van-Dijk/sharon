import {EVENT_LINE_URL,eventLineConnected,setEventLineConnected} from '../core/events/EventLineSource.js?v=0.5.22';
import {moduleIcon,homeModules,homeOrder} from './ModuleIcons.js?v=0.5.22';
import {bindNotesBoard,openShopPairing} from './ShopPairing.js?v=0.5.22';
import {ConnectionService} from '../core/connection/ConnectionService.js?v=0.5.22';

// Home visibility changes only navigation; module data and app grants stay intact.
export function openAppsView(outlet,{settings,store,items,onChanged=()=>{},connection=new ConnectionService(store)}){
 const document=outlet.ownerDocument,known=new Map(items.map(item=>[item.id,item]));
 let selected=homeModules(settings.get(),items.map(item=>item.id));
 let order=homeOrder(settings.get(),items.map(item=>item.id));
 let mode='home',busy=false,disposed=false,dragged=null,closePairing=()=>{};
 const root=document.createElement('section');root.className='sh-apps-view module-view';
 const tabs=document.createElement('div');tabs.className='sh-apps-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Apps en onderdelen');
 const panel=document.createElement('div');panel.className='sh-apps-panel';
 const status=document.createElement('p');status.setAttribute('role','status');
 const button=(label,fn)=>{const element=document.createElement('button');element.type='button';element.textContent=label;element.onclick=fn;return element;};
 for(const [id,label] of [['home','Mijn Sharon'],['apps','Apps verbinden']]){const tab=button(label,()=>{mode=id;paint();});tab.dataset.appsTab=id;tabs.append(tab);}
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
    if(dialog.isConnected)render(connected);
   }catch(error){
    feedback.textContent=error.message;
    for(const control of actions.children)control.disabled=false;
   }
  };
  const render=connected=>{
   actions.replaceChildren(connected
    ? button('Open Event Line',()=>{close();mode='eventline';paint();})
    : button('Verbind Event Line',()=>choose(true)));
   if(connected)actions.append(button('Ontkoppelen',()=>choose(false)));
  };
  body.append(intro,actions,feedback,button('Sluiten',close));dialog.append(header,body);
  dialog.addEventListener('close',close,{once:true});
  closePairing=close;document.body.append(dialog);dialog.showModal();
  eventLineConnected(store).then(render,error=>{feedback.textContent=error.message;});
 }
 function paint(){
  if(disposed)return;
  tabs.querySelectorAll('button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.appsTab===(mode==='eventline'?'apps':mode))));
  panel.replaceChildren();
  if(mode==='eventline'){
   const nav=document.createElement('div');nav.className='sh-eventline-controls';
   const back=button('Terug naar apps',()=>{
    mode='apps';paint();panel.querySelector('[data-app-link="eventline"]')?.focus();
   });
   const external=document.createElement('a');
   external.href=EVENT_LINE_URL;external.target='_blank';external.rel='noopener noreferrer';
   external.textContent='Open in browser';
   nav.append(back,external);
   const frame=document.createElement('iframe');
   frame.src=EVENT_LINE_URL;frame.title='Event Line';frame.className='sh-eventline-frame';
   panel.append(nav,frame);back.focus();
   return;
  }
  if(mode==='apps'){
   const strip=button('',()=>{
    closePairing();closePairing=openShopPairing(connection,{layoutStore:store,onConnected:()=>{
     if(!selected.includes('notes')&&known.has('notes'))save([...selected,'notes']);
    }});
   });strip.className='sh-app-connection';strip.dataset.appConnection='shoplist';strip.disabled=busy;
   const logo=document.createElement('span');logo.className='sh-module-icon';logo.innerHTML=moduleIcon('notes');
   const copy=document.createElement('span'),name=document.createElement('strong');name.textContent='ShopList.';copy.append(name);
   const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');strip.append(logo,copy,arrow);panel.append(strip);

   const eventLine=button('',openEventLineBoard);
   eventLine.className='sh-app-connection sh-eventline-link';
   eventLine.dataset.appLink='eventline';
   eventLine.innerHTML=moduleIcon('agenda')+
    '<span><strong>Event Line</strong></span>'+
    '<span aria-hidden="true">↗</span>';
   panel.append(eventLine);
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
 paint();return ()=>{disposed=true;dragged=null;closePairing();};
}
