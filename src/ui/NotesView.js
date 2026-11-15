import {openShopPairing} from './ShopPairing.js?v=0.4.83';
import {openListShare} from './ListSharing.js?v=0.4.83';
import {renderListControls,bindListControls,renderOrderControls} from './ListControls.js?v=0.4.83';
import {sortList,moveInOrder,moveToPosition} from '../core/storage/ListOrder.js?v=0.4.83';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.4.83';
import {renderObjectStrip} from './ObjectStrip.js?v=0.4.83';
import {bindSwipeRows} from './SwipeRows.js?v=0.4.83';
import {IdentifierService} from '../core/ids/IdentifierService.js?v=0.4.83';
export async function openNotesView(outlet,{store,api=new ShopListService(store),headerActions}){
 const document=globalThis.document;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
 let disposed=false,release=()=>{},releaseControls=()=>{},local=[],linked=[],closeBoard=()=>{},closeShare=()=>{},visible=[],mode='items';
 let prefs=(await store.get?.('meta','notes.list.preferences'))?.value||{sort:'alpha',order:[]};if(!['alpha','recent','custom'].includes(prefs.sort))prefs.sort='alpha';
 outlet.replaceChildren();const root=node('section',null,'module-view locations-view sh-card-view sh-notes-view'),tools=node('div',null,'sh-notes-tools'),controls=node('div'),rows=node('div',null,'sh-locations-list swipe-list'),status=node('p');status.setAttribute('role','status');
 controls.innerHTML=renderListControls({placeholder:'Zoek notities, ideeën en lijsten',sort:prefs.sort});const search=controls.querySelector('input');
 const add=button('+',()=>edit());add.className='sh-location-header-add';add.setAttribute('aria-label','Notitie of lijst toevoegen');
 if(headerActions){headerActions.replaceChildren(add);}else tools.append(add);
 const modes=node('div',null,'sh-notes-modes');modes.setAttribute('aria-label','Toon');
 for(const [key,label,icon] of [['items','Items','☰'],['connections','Koppelingen','↔'],['archive','Archief','▤']]){const b=button(icon,()=>{mode=key;paint();});b.dataset.notesMode=key;b.setAttribute('aria-label',label);b.title=label;modes.append(b);}
 controls.querySelector('.sh-card-sort-icons').append(modes);
 const connections=node('div',null,'sh-notes-connections');
 const connect=button('',()=>{closeBoard();closeBoard=openShopPairing(api.connection,{autoCreate:true});});connect.className='sh-app-connection';connect.append(node('strong','ShopList.'),node('span','Koppel je boodschappenlijsten'),node('span','↗'));connections.append(connect);
 root.append(tools,controls,connections,rows,status);outlet.append(root);
 const savePrefs=()=>store.put('meta',{key:'notes.list.preferences',value:prefs});
 const report=e=>{if(!disposed)status.textContent=e.message;};
 function board(title,shop=false){
  closeBoard();const previous=document.activeElement,dialog=node('dialog',null,'sh-notes-board');dialog.setAttribute('aria-label',title);const head=node('header',null,shop?'sh-notes-brand':'sh-notes-heading');
  if(shop)head.append(node('strong','ShopList.','sh-notes-wordmark'));head.append(node('h2',title));const body=node('div',null,'sh-notes-body');dialog.append(head,body,button('Sluiten',()=>dialog.close()));document.body.append(dialog);
  let closed=false;closeBoard=()=>{if(closed)return;closed=true;dialog.remove();previous?.focus();};dialog.addEventListener('close',closeBoard,{once:true});dialog.showModal();return {dialog,body};
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
 async function openLocal(record){
  const {body}=board(record.name);if(record.data?.kind==='list'){
   for(const [index,item]of (record.data.items||[]).entries()){const label=node('label',null,'sh-notes-check'),check=node('input');check.type='checkbox';check.checked=!!item.done;check.onchange=async()=>{const old=item.done;item.done=check.checked;try{await store.put('objects',{...record,updatedAt:Date.now()});}catch(e){item.done=old;check.checked=!!old;report(e);}};label.append(check,node('span',item.text));body.append(label);}
  }else{body.append(node('p',record.data?.body||'', 'sh-notes-text'));}
  body.append(button('Bewerken',()=>edit(record)),button(record.archivedAt?'Terugzetten':'Archiveren',async()=>{await store.put('objects',{...record,archivedAt:record.archivedAt?null:Date.now()});await loadLocal();closeBoard();}));
 }
 async function openLinked(list,sharing=false){
  if(sharing){closeBoard();closeShare();closeShare=openListShare(list,{store,api});return;}
  const {dialog,body}=board(list.name,true),message=node('p',sharing?'Contacten laden…':'Lijst ophalen…');message.setAttribute('role','status');body.append(message);
  body.append(button(list.archived?'Terugzetten':'Archiveren',async()=>{try{await api.archive(list.id,!list.archived);await loadLinked();dialog.close();}catch(e){message.textContent=e.message;}}),button('Uit mijn overzicht verwijderen',()=>{
   const {body:confirmBody,dialog:confirmDialog}=board('Lijst verwijderen');confirmBody.append(node('p','Verwijder deze lijst uit jouw overzicht in Sharon en ShopList. Andere deelnemers behouden toegang. Als laatste deelnemer verwijder je de lijst volledig.'),button('Verwijderen',async()=>{try{await api.leave(list.id);await loadLinked();confirmDialog.close();}catch(e){report(e);}}));
  }));
  try{
   const response=await api.read(list.id);if(disposed||!dialog.isConnected)return;
   const payload=response.list.payload;message.textContent='';
   {
    const products=new Map(payload.products.map(p=>[p.id,p]));
    const listRows=node('div');for(const item of payload.list.items){listRows.append(node('p',(item.done?'✓ ':'')+item.quantity+' × '+(products.get(item.productId)?.name||'Product')));}body.append(listRows);
    if(!payload.list.items.length)body.append(node('p','Deze lijst is nog leeg.'));
    if(response.role==='owner')body.append(button('Delen',()=>openLinked(list,true)));
   }
  }catch(e){if(dialog.isConnected)message.textContent=e.message;}
 }
 function paint(){
  if(disposed||!root.isConnected)return;release();releaseControls();const q=search.value.toLocaleLowerCase('nl');rows.replaceChildren();
  connections.hidden=mode!=='connections';rows.hidden=mode==='connections';modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.notesMode===mode)));
  visible=sortList([...local.filter(r=>!!r.archivedAt===(mode==='archive')).map(r=>({id:'local:'+r.id,title:r.name,subtitle:({note:'Notitie',idea:'Idee',list:'Lijst'})[r.data?.kind]||'Notitie',record:r,updatedAt:r.updatedAt,createdAt:r.createdAt})),...linked.filter(r=>!!r.archived===(mode==='archive')).map(r=>({id:'linked:'+r.id,title:r.name,subtitle:'Boodschappen · ShopList',record:r,linked:true,updatedAt:r.updatedAt}))].filter(r=>(r.title+' '+(r.record.data?.body||'')).toLocaleLowerCase('nl').includes(q)),{sort:prefs.sort,order:prefs.order});
  for(const row of visible)rows.insertAdjacentHTML('beforeend','<div class="sh-list-item" data-list-item>'+renderObjectStrip({module:'tasks',id:row.id,title:row.title,subtitle:row.subtitle,shareable:row.linked&&row.record.role==='owner',accentColor:row.linked?'#da6342':'#489ff8',actions:row.linked?[]:[{kind:'edit',label:'Bewerk'},{kind:'delete',label:'Verwijder'}]})+(prefs.sort==='custom'?renderOrderControls(row.id):'')+'</div>');
  if(!visible.length)rows.append(node('p','Nog geen passende notities of lijsten.'));
  controls.querySelectorAll('[data-list-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.listSort===prefs.sort)));
  releaseControls=bindListControls(rows,{onMove:async(id,direction)=>{prefs.order=moveInOrder(visible.map(r=>r.id),id,direction);await savePrefs();paint();},onMoveTo:async(id,target,after)=>{prefs.order=moveToPosition(visible.map(r=>r.id),id,target,after);await savePrefs();paint();}});
  const find=id=>visible.find(r=>r.id===id);
  release=bindSwipeRows(rows,{onOpen:id=>{const r=find(id);if(r)(r.linked?openLinked(r.record):openLocal(r.record));},onShare:id=>{const r=find(id);if(r?.linked)openLinked(r.record,true);},onEdit:id=>edit(find(id).record),onDelete:async id=>{const r=find(id);try{await store.put('objects',{...r.record,archivedAt:Date.now()});await loadLocal();}catch(e){report(e);}}});
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
