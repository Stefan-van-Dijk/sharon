import {moduleIcon,homeModules} from './ModuleIcons.js?v=0.4.89';
import {openShopPairing} from './ShopPairing.js?v=0.4.89';
import {ConnectionService} from '../core/connection/ConnectionService.js?v=0.4.89';

// Home visibility changes only navigation; module data and app grants stay intact.
export function openAppsView(outlet,{settings,store,items,onChanged=()=>{},connection=new ConnectionService(store)}){
 const document=outlet.ownerDocument,known=new Map(items.map(item=>[item.id,item]));
 let selected=homeModules(settings.get(),items.map(item=>item.id));
 let mode='home',busy=false,disposed=false,dragged=null,closePairing=()=>{};
 const root=document.createElement('section');root.className='sh-apps-view module-view';
 const tabs=document.createElement('div');tabs.className='sh-apps-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Apps en onderdelen');
 const panel=document.createElement('div');panel.className='sh-apps-panel';
 const status=document.createElement('p');status.setAttribute('role','status');
 const button=(label,fn)=>{const element=document.createElement('button');element.type='button';element.textContent=label;element.onclick=fn;return element;};
 for(const [id,label] of [['home','Mijn Sharon'],['apps','Apps verbinden']]){const tab=button(label,()=>{mode=id;paint();});tab.dataset.appsTab=id;tabs.append(tab);}
 root.append(tabs,panel,status);outlet.replaceChildren(root);
 async function save(next){
  if(busy||disposed)return false;
  busy=true;status.textContent='';paint();
  try{
   await settings.update({home:{modules:next}});
   selected=[...next];if(!disposed)onChanged([...selected]);return true;
  }catch(error){if(!disposed)status.textContent=error.message||'Je keuze kon niet worden bewaard.';return false;}
  finally{busy=false;if(!disposed)paint();}
 }
 function move(id,target){
  const from=selected.indexOf(id);if(from<0||target<0||target>=selected.length||from===target)return;
  const next=[...selected];next.splice(from,1);next.splice(target,0,id);save(next);
 }
 function paint(){
  if(disposed)return;
  tabs.querySelectorAll('button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.appsTab===mode)));
  panel.replaceChildren();
  if(mode==='apps'){
   const strip=button('',()=>{
    closePairing();closePairing=openShopPairing(connection,{autoCreate:true});
    if(!selected.includes('notes')&&known.has('notes'))save([...selected,'notes']);
   });strip.className='sh-app-connection';strip.dataset.appConnection='shoplist';strip.disabled=busy;
   const logo=document.createElement('span');logo.className='sh-module-icon';logo.innerHTML=moduleIcon('notes');
   const copy=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent='ShopList.';detail.textContent='Lijsten verschijnen in Notities en lijsten.';copy.append(name,detail);
   const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');strip.append(logo,copy,arrow);panel.append(strip);return;
  }
  const hint=document.createElement('p');hint.className='sh-apps-hint';hint.textContent='Kies je onderdelen. Sleep zichtbare onderdelen in jouw volgorde.';panel.append(hint);
  const ordered=[...selected,...items.map(item=>item.id).filter(id=>!selected.includes(id))];
  for(const id of ordered){
   const item=known.get(id),enabled=selected.includes(id),row=document.createElement('div');row.className='sh-apps-module-row';row.dataset.moduleChoice=id;
   const toggle=button('',()=>save(enabled?selected.filter(value=>value!==id):[...selected,id]));toggle.className='sh-apps-module-toggle';toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(enabled));toggle.setAttribute('aria-label',item.title);toggle.disabled=busy;
   const icon=document.createElement('span');icon.className='sh-module-icon';icon.innerHTML=moduleIcon(id);const title=document.createElement('span');title.textContent=item.title;const mark=document.createElement('span');mark.className='sh-apps-switch';mark.setAttribute('aria-hidden','true');toggle.append(icon,title,mark);row.append(toggle);
   if(enabled){
    const controls=document.createElement('div');controls.className='sh-apps-order';
    for(const [delta,label] of [[-1,'Omhoog'],[1,'Omlaag']]){const control=button(delta<0?'↑':'↓',()=>move(id,selected.indexOf(id)+delta));control.setAttribute('aria-label',item.title+' '+label.toLowerCase());control.disabled=busy||selected.indexOf(id)+delta<0||selected.indexOf(id)+delta>=selected.length;controls.append(control);}
    row.draggable=!busy;row.addEventListener('dragstart',event=>{dragged=id;event.dataTransfer?.setData('text/plain',id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});row.addEventListener('dragend',()=>{dragged=null;});
    row.addEventListener('dragover',event=>{if(dragged&&dragged!==id&&!busy)event.preventDefault();});row.addEventListener('drop',event=>{event.preventDefault();if(dragged&&!busy)move(dragged,selected.indexOf(id));dragged=null;});row.append(controls);
   }
   panel.append(row);
  }
 }
 paint();return ()=>{disposed=true;dragged=null;closePairing();};
}
