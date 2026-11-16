import {mountShopListPanel} from './ShopListPanel.js?v=0.4.91';
import {openNotesDeck} from './NotesDeck.js?v=0.4.91';
import {bindNotesBoard} from './ShopPairing.js?v=0.4.91';
import {openListShare} from './ListSharing.js?v=0.4.91';
import {renderListControls,bindListControls,renderOrderControls} from './ListControls.js?v=0.4.91';
import {sortList,moveInOrder,moveToPosition} from '../core/storage/ListOrder.js?v=0.4.91';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.4.91';
import {renderObjectStrip} from './ObjectStrip.js?v=0.4.91';
import {bindSwipeRows} from './SwipeRows.js?v=0.4.91';
import {IdentifierService} from '../core/ids/IdentifierService.js?v=0.4.91';
export async function openNotesView(outlet,{store,api=new ShopListService(store),headerActions}){
 const document=outlet.ownerDocument,window=document.defaultView;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
 let disposed=false,release=()=>{},releaseControls=()=>{},local=[],linked=[],closeBoard=()=>{},closeShare=()=>{},visible=[],showArchive=false,archiveRevealed=false;
 let prefs=(await store.get?.('meta','notes.list.preferences'))?.value||{sort:'alpha',order:[]};if(!['alpha','recent','custom'].includes(prefs.sort))prefs.sort='alpha';
 outlet.replaceChildren();const root=node('section',null,'module-view locations-view sh-card-view sh-notes-view'),tools=node('div',null,'sh-notes-tools'),controls=node('div'),rows=node('div',null,'sh-locations-list swipe-list'),status=node('p');status.setAttribute('role','status');
 controls.innerHTML=renderListControls({placeholder:'Zoek notities, ideeën en lijsten',sort:prefs.sort});const search=controls.querySelector('input');
 const add=button('+',()=>edit());add.className='sh-location-header-add';add.setAttribute('aria-label','Notitie of lijst toevoegen');
 if(headerActions){headerActions.replaceChildren(add);}else tools.append(add);
 const archiveSlot=node('div',null,'sh-notes-archive-slot');
 const archive=button('Archief',()=>{showArchive=!showArchive;suppressClickUntil=0;search.value='';paint();});archive.dataset.notesArchive='';archive.setAttribute('aria-pressed','false');archiveSlot.append(archive);
 archive.onfocus=()=>{archiveRevealed=true;archiveSlot.classList.add('is-revealed');};
 const listArea=node('div',null,'sh-notes-list-area');listArea.append(archiveSlot,rows);
 root.append(tools,controls,listArea,status);outlet.append(root);
 let pull=null,suppressClickUntil=0;
 const hasArchive=()=>local.some(r=>r.archivedAt)||linked.some(r=>r.archived);
 const atTop=()=>{for(let el=listArea;el;el=el.parentElement)if(el.scrollTop>1)return false;return !(document.scrollingElement?.scrollTop>1);};
 const startPull=(x,y)=>{pull=hasArchive()&&!showArchive&&!archiveRevealed&&atTop()?{x,y,distance:0}:null;};
 const movePull=(event,x,y)=>{if(!pull)return;const dx=x-pull.x,dy=y-pull.y;if(dy<0||Math.abs(dx)>Math.max(10,Math.abs(dy))){pull=null;return;}pull.distance=dy;if(dy>8&&event.cancelable)event.preventDefault();};
 const endPull=()=>{if(pull?.distance>=48){suppressClickUntil=Date.now()+400;archiveRevealed=true;archiveSlot.classList.add('is-revealed');}pull=null;};
 const cancelPull=()=>{pull=null;};
 const suppressPullClick=event=>{if(Date.now()<suppressClickUntil&&!event.target.closest('[data-notes-archive]')){event.preventDefault();event.stopImmediatePropagation();}};
 listArea.addEventListener('click',suppressPullClick,true);
 const touchStart=event=>{if(event.touches.length!==1){cancelPull();return;}const t=event.touches[0];startPull(t.clientX,t.clientY);};
 const touchMove=event=>{if(event.touches.length!==1){cancelPull();return;}const t=event.touches[0];movePull(event,t.clientX,t.clientY);};
 const pointerStart=event=>{if(event.pointerType!=='touch'&&event.button===0)startPull(event.clientX,event.clientY);};
 const pointerMove=event=>{if(event.pointerType!=='touch')movePull(event,event.clientX,event.clientY);};
 const pointerEnd=event=>{if(event.pointerType!=='touch')endPull();};
 listArea.addEventListener('touchstart',touchStart,{passive:true});listArea.addEventListener('touchmove',touchMove,{passive:false});listArea.addEventListener('touchend',endPull);listArea.addEventListener('touchcancel',cancelPull);
 listArea.addEventListener('pointerdown',pointerStart);window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerEnd);window.addEventListener('pointercancel',cancelPull);
 const releasePull=()=>{cancelPull();listArea.removeEventListener('click',suppressPullClick,true);listArea.removeEventListener('touchstart',touchStart);listArea.removeEventListener('touchmove',touchMove);listArea.removeEventListener('touchend',endPull);listArea.removeEventListener('touchcancel',cancelPull);listArea.removeEventListener('pointerdown',pointerStart);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerEnd);window.removeEventListener('pointercancel',cancelPull);};
 const savePrefs=()=>store.put('meta',{key:'notes.list.preferences',value:prefs});
 const report=e=>{if(!disposed)status.textContent=e.message;};
 function board(title,shop=false,onOpen){
  closeBoard();const previous=document.activeElement,dialog=node('dialog',null,'sh-notes-board');dialog.setAttribute('aria-label',title);const head=node('header',null,shop?'sh-notes-brand':'sh-notes-heading');
  if(shop)head.append(node('strong','ShopList.','sh-notes-wordmark'));head.append(node('h2',title));const body=node('div',null,'sh-notes-body');dialog.append(head,body);document.body.append(dialog);
  let releaseBoard=()=>{},closed=false;closeBoard=()=>{if(closed)return;closed=true;releaseBoard();dialog.remove();previous?.focus();};dialog.addEventListener('close',closeBoard,{once:true});releaseBoard=bindNotesBoard(dialog,head,closeBoard,{shop,onOpen});dialog.showModal();return {dialog,body};
 }
 async function edit(record){
  const {dialog,body}=board(record?'Bewerken':'Nieuwe notitie of lijst');
  const title=node('input'),kind=node('select'),text=node('textarea');title.value=record?.name||'';title.placeholder='Titel';title.setAttribute('aria-label','Titel');
  for(const [v,t]of [['note','Notitie'],['idea','Idee'],['list','Lijst']]){const o=node('option',t);o.value=v;kind.append(o);}kind.value=record?.data?.kind||'note';kind.setAttribute('aria-label','Soort');
  text.value=kind.value==='list'?(record?.data?.items||[]).map(i=>i.text).join('\n'):(record?.data?.body||'');text.setAttribute('aria-label','Tekst of lijstregels');text.rows=10;
  body.append(title,kind,text,node('p','Bij een lijst wordt iedere tekstregel een afvinkbare regel.'));
  const message=node('p');message.setAttribute('role','status');
  const save=button('Bewaren',async()=>{if(!title.value.trim()){message.textContent='Geef een titel op.';return;}save.disabled=true;try{
   const oldItems=record?.data?.items||[];const item={...record,id:record?.id||IdentifierService.create(),type:'note',name:title.value.trim(),createdAt:record?.createdAt||Date.now(),updatedAt:Date.now(),data:{...record?.data,kind:kind.value,body:text.value,items:kind.value==='list'?text.value.split('\n').filter(t=>t.trim()).map((t,i)=>({text:t,done:oldItems[i]?.text===t?!!oldItems[i].done:false})):[]}};
   await store.put('objects',item);if(disposed)return;await loadLocal();dialog.close();
  }catch(e){message.textContent=e.message;}finally{save.disabled=false;}});body.append(message,save);title.focus();
 }
 function openLocal(record){openItem('local:'+record.id);}
 function openLinked(list,sharing=false){
  if(sharing){closeBoard();closeShare();closeShare=openListShare(list,{store,api,onOpen:()=>{closeShare();openItem('linked:'+list.id);}});return;}
  openItem('linked:'+list.id);
 }
 function openItem(id){
  closeBoard();closeShare();
  closeBoard=openNotesDeck({items:()=>visible,id,store,render:async(row,{body,title,isCurrent,fullscreen,setBeforeLeave})=>{
   const record=row.record;
   if(!row.linked){
    if(record.data?.kind==='list'){
     for(const item of record.data.items||[]){const label=node('label',null,'sh-notes-check'),check=node('input');check.type='checkbox';check.checked=!!item.done;check.onchange=async()=>{const old=item.done;item.done=check.checked;try{await store.put('objects',{...record,updatedAt:Date.now()});}catch(e){item.done=old;check.checked=!!old;report(e);}};label.append(check,node('span',item.text));body.append(label);}
    }else body.append(node('p',record.data?.body||'','sh-notes-text'));
    return;
   }
   const message=node('p','Lijst ophalen…');message.setAttribute('role','status');body.append(message);
   try{
    const response=await api.read(record.id);if(disposed||!isCurrent())return;
    const payload=response.list.payload;
    if(payload.list.id&&payload.list.id!==record.id)throw Error('De ontvangen lijst komt niet overeen. Open de lijst opnieuw.');
    message.textContent='';if(payload.list.name)title.textContent=payload.list.name;
    if(fullscreen){const panel=mountShopListPanel({body,response,api,isCurrent,onUpdated:()=>{loadLinked().catch(report);}});setBeforeLeave(panel.beforeLeave);return;}
    const products=new Map(payload.products.map(p=>[p.id,p]));
    for(const item of payload.list.items)body.append(node('p',(item.done?'✓ ':'')+item.quantity+' × '+(products.get(item.productId)?.name||'Product')));
    if(!payload.list.items.length)body.append(node('p','Deze lijst is nog leeg.'));
   }catch(e){if(isCurrent())message.textContent=e.message;}
  }});
 }
 async function changeArchive(row){
  if(row.linked){await api.archive(row.record.id,!row.record.archived);await loadLinked();}
  else{await store.put('objects',{...row.record,archivedAt:row.record.archivedAt?null:Date.now()});await loadLocal();}
 }
 function openArchived(row){
  const {body,dialog}=board(row.title);const restore=button('Terugzetten',async()=>{restore.disabled=true;try{await changeArchive(row);dialog.close();}catch(error){report(error);restore.disabled=false;}});body.append(node('p','Zet dit item terug in je notities en lijsten.'),restore);
 }
 function paint(){
  if(disposed||!root.isConnected)return;release();releaseControls();const q=search.value.toLocaleLowerCase('nl');rows.replaceChildren();
  if(!hasArchive()){showArchive=false;archiveRevealed=false;}
  archiveSlot.hidden=!hasArchive();archiveSlot.classList.toggle('is-revealed',archiveRevealed||showArchive);archive.setAttribute('aria-pressed',String(showArchive));archive.textContent=showArchive?'Terug naar notities en lijsten':'Archief';
  visible=sortList([...local.filter(r=>!!r.archivedAt===showArchive).map(r=>({id:'local:'+r.id,title:r.name,subtitle:({note:'Notitie',idea:'Idee',list:'Lijst'})[r.data?.kind]||'Notitie',record:r,updatedAt:r.updatedAt,createdAt:r.createdAt})),...linked.filter(r=>!!r.archived===showArchive).map(r=>({id:'linked:'+r.id,title:r.name,subtitle:'Boodschappen · ShopList',record:r,linked:true,updatedAt:r.updatedAt}))].filter(r=>(r.title+' '+(r.record.data?.body||'')).toLocaleLowerCase('nl').includes(q)),{sort:prefs.sort,order:prefs.order});
  for(const row of visible)rows.insertAdjacentHTML('beforeend','<div class="sh-list-item" data-list-item>'+renderObjectStrip({module:'tasks',id:row.id,title:row.title,subtitle:row.subtitle,shareable:row.linked&&row.record.role==='owner',accentColor:row.linked?'#da6342':'#489ff8',actions:[...(!row.linked?[{kind:'edit',label:'Bewerk'}]:[]),{kind:'secondary',label:showArchive?'Terugzetten':'Archiveren'},{kind:'delete',label:'Verwijder'}]})+(prefs.sort==='custom'?renderOrderControls(row.id):'')+'</div>');
  if(!visible.length)rows.append(node('p','Nog geen passende notities of lijsten.'));
  controls.querySelectorAll('[data-list-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.listSort===prefs.sort)));
  releaseControls=bindListControls(rows,{onMove:async(id,direction)=>{prefs.order=moveInOrder(visible.map(r=>r.id),id,direction);await savePrefs();paint();},onMoveTo:async(id,target,after)=>{prefs.order=moveToPosition(visible.map(r=>r.id),id,target,after);await savePrefs();paint();}});
  const find=id=>visible.find(r=>r.id===id);
  release=bindSwipeRows(rows,{onOpen:id=>{const r=find(id);if(r){if(showArchive)openArchived(r);else r.linked?openLinked(r.record):openLocal(r.record);}},onShare:id=>{const r=find(id);if(r?.linked)openLinked(r.record,true);},onEdit:id=>edit(find(id).record),onSecondary:async id=>{const r=find(id);try{await changeArchive(r);}catch(e){report(e);}},onDelete:id=>{
   const r=find(id);const {body,dialog}=board('Verwijderen');
   body.append(node('p',r.linked?'Verwijder deze lijst uit jouw overzicht in Sharon en ShopList. Andere deelnemers behouden toegang. Als laatste deelnemer verwijder je de lijst volledig.':'Verwijder deze notitie of lijst uit jouw overzicht.'),button('Verwijderen',async()=>{try{if(r.linked){await api.leave(r.record.id);await loadLinked();}else{await store.put('objects',{...r.record,deletedAt:Date.now()});await loadLocal();}dialog.close();}catch(e){report(e);}}));
  }});
 }
 async function loadLocal(){local=(await store.getAll('objects')).filter(r=>r.type==='note'&&!r.deletedAt);paint();}
 search.oninput=paint;controls.querySelectorAll('[data-list-sort]').forEach(b=>b.onclick=async()=>{prefs.sort=b.dataset.listSort;try{await savePrefs();paint();}catch(e){report(e);}});
 await loadLocal();
 if(!root.isConnected)return ()=>{};
 async function loadLinked(){const result=await api.index();if(disposed)return;linked=result.lists;paint();}
 const refresh=()=>{if(!document.hidden)loadLinked().catch(report);};document.addEventListener('visibilitychange',refresh);
 loadLinked().catch(e=>{if(!disposed)status.textContent='Notities werken lokaal. Gekoppelde lijsten zijn niet bereikbaar: '+e.message;});
 return ()=>{disposed=true;document.removeEventListener('visibilitychange',refresh);releasePull();release();releaseControls();closeBoard();closeShare();if(headerActions)headerActions.replaceChildren();};
}
