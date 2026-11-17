import {shopContextMode,shopPreview} from '../core/shoplist/ShopContext.js?v=0.4.100';
import {mountShopApp} from './ShopApp.js?v=0.4.100';
import {openNotesDeck} from './NotesDeck.js?v=0.4.100';
import {bindNotesBoard} from './ShopPairing.js?v=0.4.100';
import {openListShare} from './ListSharing.js?v=0.4.100';
import {renderListControls,bindListControls,renderOrderControls} from './ListControls.js?v=0.4.100';
import {sortList,moveInOrder,moveToPosition} from '../core/storage/ListOrder.js?v=0.4.100';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.4.100';
import {renderObjectStrip} from './ObjectStrip.js?v=0.4.100';
import {bindSwipeRows} from './SwipeRows.js?v=0.4.100';
import {IdentifierService} from '../core/ids/IdentifierService.js?v=0.4.100';
export async function openNotesView(outlet,{store,api=new ShopListService(store),headerActions,location}){
 const document=outlet.ownerDocument,window=document.defaultView;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
 let disposed=false,release=()=>{},releaseControls=()=>{},local=[],linked=[],closeBoard=()=>{},closeShare=()=>{},visible=[],showArchive=false;
 let prefs=(await store.get?.('meta','notes.list.preferences'))?.value||{sort:'alpha',order:[]};if(!['alpha','recent','custom'].includes(prefs.sort))prefs.sort='alpha';
 outlet.replaceChildren();const root=node('section',null,'module-view locations-view sh-card-view sh-notes-view'),tools=node('div',null,'sh-notes-tools'),controls=node('div'),rows=node('div',null,'sh-locations-list swipe-list'),status=node('p');status.setAttribute('role','status');
 controls.innerHTML=renderListControls({placeholder:'Zoek notities, ideeën en lijsten',sort:prefs.sort});const search=controls.querySelector('input');
 const add=button('+',()=>edit());add.className='sh-location-header-add';add.setAttribute('aria-label','Notitie of lijst toevoegen');
 if(headerActions){headerActions.replaceChildren(add);}else tools.append(add);
 const archiveSlot=node('div',null,'sh-notes-archive-slot');
 const archive=button('Archief',()=>{showArchive=!showArchive;search.value='';paint();});archive.dataset.notesArchive='';archive.setAttribute('aria-pressed','false');archiveSlot.append(archive);
 const listArea=node('div',null,'sh-notes-list-area');listArea.append(rows,archiveSlot);
 root.append(tools,controls,listArea,status);outlet.append(root);
 const hasArchive=()=>local.some(r=>r.archivedAt)||linked.some(r=>r.archived);
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
  closeBoard=openNotesDeck({items:()=>visible,id,store,onAppView:(row,mode)=>store.put('meta',{key:'shop.view.'+row.record.id,value:mode}).catch(report),onAppReturn:()=>loadLinked().catch(report),render:async(row,{body,title,isCurrent,fullscreen,openApp,setBeforeLeave,setCleanup})=>{
   const record=row.record;
   if(!row.linked){
    if(record.data?.kind==='list'){
     for(const item of record.data.items||[]){const label=node('label',null,'sh-notes-check'),check=node('input');check.type='checkbox';check.checked=!!item.done;check.onchange=async()=>{const old=item.done;item.done=check.checked;try{await store.put('objects',{...record,updatedAt:Date.now()});}catch(e){item.done=old;check.checked=!!old;report(e);}};label.append(check,node('span',item.text));body.append(label);}
    }else body.append(node('p',record.data?.body||'','sh-notes-text'));
    return;
   }
   const last=(await store.get?.('meta','shop.view.'+record.id))?.value;
   const mode=shopContextMode(await store.getAll('objects'),location?.latest,last);
   if(!isCurrent())return;
   if(fullscreen){mountShopApp(body,record.id,{api,mode,registerCleanup:setCleanup});return;}
   const message=node('p','Lijst ophalen…');message.setAttribute('role','status');body.append(message);
   try{
    const response=await api.read(record.id);if(disposed||!isCurrent())return;
    const payload=response.list.payload;
    if(payload.list.id&&payload.list.id!==record.id)throw Error('De ontvangen lijst komt niet overeen. Open de lijst opnieuw.');
    message.textContent='';if(payload.list.name)title.textContent=payload.list.name;
    const preview=shopPreview(payload,mode),section=node('section',null,'sh-shop-preview');
    section.append(node('small',mode==='check'?'Afstrepen':'Verzamelen'),node('h3',mode==='check'?'Nog in je mandje':'Nog nodig'));
    section.append(node('p',preview.done+' van '+preview.total+' afgevinkt','sh-shop-progress'));
    for(const item of preview.rows){const line=node('div',null,'sh-shop-preview-row');line.append(node('span',item.name),node('span',item.quantity+' ×'));section.append(line);}
    if(preview.remaining>4)section.append(node('p','En nog '+(preview.remaining-4)+' producten…','sh-shop-progress'));
    if(!preview.total)section.append(node('p','Voeg je eerste producten toe in ShopList.'));
    else if(!preview.remaining)section.append(node('p','Alles op deze lijst is afgevinkt.'));
    const open=button(mode==='check'?'Verder met afstrepen':'Open verzamelen',openApp);open.className='sh-shop-preview-open';section.append(open);body.append(section);

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
  if(!hasArchive()){showArchive=false;}
  archiveSlot.hidden=!hasArchive();archive.setAttribute('aria-pressed',String(showArchive));archive.textContent=showArchive?'Terug naar notities en lijsten':'Archief · herstellen';
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
 return ()=>{disposed=true;document.removeEventListener('visibilitychange',refresh);release();releaseControls();closeBoard();closeShare();if(headerActions)headerActions.replaceChildren();};
}
