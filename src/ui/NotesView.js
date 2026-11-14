import {ShopListService,SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.4.78';
import {renderObjectStrip} from './ObjectStrip.js?v=0.4.78';
import {bindSwipeRows} from './SwipeRows.js?v=0.4.78';
import {IdentifierService} from '../core/ids/IdentifierService.js?v=0.4.78';
export async function openNotesView(outlet,{store,api=new ShopListService(store)}){
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
 let disposed=false,release=()=>{},local=[],linked=[],closeBoard=()=>{};
 outlet.replaceChildren();const root=node('section',null,'sh-notes-view'),tools=node('div',null,'sh-notes-tools'),search=node('input'),rows=node('div'),status=node('p');status.setAttribute('role','status');search.type='search';search.placeholder='Zoek notities, ideeën en lijsten';search.setAttribute('aria-label',search.placeholder);
 const add=button('Nieuw',()=>edit());const connect=node('a','Lijst koppelen in ShopList');connect.href=SHOPLIST_URL;tools.append(add,connect);root.append(tools,search,rows,status);outlet.append(root);
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
  body.append(button('Bewerken',()=>edit(record)));
 }
 async function openLinked(list,sharing=false){
  const {dialog,body}=board(list.name,true),message=node('p',sharing?'Contacten laden…':'Lijst ophalen…');message.setAttribute('role','status');body.append(message);
  const open=node('a','Open in ShopList');open.href=SHOPLIST_URL+'?shoplist='+encodeURIComponent(list.id);body.append(open);
  try{
   const response=await api.read(list.id);if(disposed||!dialog.isConnected)return;
   const payload=response.list.payload;message.textContent='';
   if(sharing){
    if(response.role!=='owner'){message.textContent='Alleen de eigenaar kan deze lijst verder delen.';return;}
    const contacts=await api.connection.contacts();if(disposed||!dialog.isConnected)return;
    if(!contacts.length)message.textContent='Verbind eerst een persoon in Sharon.';
    for(const contact of contacts){const line=node('div',null,'sh-notes-person'),label=node('label',contact.name),select=node('select');select.setAttribute('aria-label','Toegang voor '+contact.name);
     for(const [v,t]of [['','Geen toegang'],['read','Bekijken'],['write','Bewerken']]){const option=node('option',t);option.value=v;select.append(option);}select.value=response.list.members[contact.personId]||'';
     const apply=button('Bewaren',async()=>{apply.disabled=true;select.disabled=true;try{await api.share(list.id,contact.personId,select.value||null);message.textContent=select.value?'Lijst gedeeld met '+contact.name+'.':'Toegang ingetrokken voor '+contact.name+'.';}catch(e){message.textContent=e.message;}finally{apply.disabled=false;select.disabled=false;}});label.append(select);line.append(label,apply);body.append(line);
    }
   }else{
    const products=new Map(payload.products.map(p=>[p.id,p]));
    const listRows=node('div');for(const item of payload.list.items){listRows.append(node('p',(item.done?'✓ ':'')+item.quantity+' × '+(products.get(item.productId)?.name||'Product')));}body.append(listRows);
    if(!payload.list.items.length)body.append(node('p','Deze lijst is nog leeg.'));
    if(response.role==='owner')body.append(button('Delen',()=>openLinked(list,true)));
   }
  }catch(e){if(dialog.isConnected)message.textContent=e.message;}
 }
 function paint(){
  if(disposed)return;release();const q=search.value.toLocaleLowerCase('nl');rows.replaceChildren();
  const visible=[...local.map(r=>({id:'local:'+r.id,title:r.name,subtitle:({note:'Notitie',idea:'Idee',list:'Lijst'})[r.data?.kind]||'Notitie',record:r})),...linked.map(r=>({id:'linked:'+r.id,title:r.name,subtitle:'Boodschappen · ShopList',record:r,linked:true}))].filter(r=>(r.title+' '+(r.record.data?.body||'')).toLocaleLowerCase('nl').includes(q)).sort((a,b)=>a.title.localeCompare(b.title,'nl'));
  for(const row of visible)rows.insertAdjacentHTML('beforeend',renderObjectStrip({id:row.id,title:row.title,subtitle:row.subtitle,shareable:row.linked&&row.record.role==='owner',accentColor:row.linked?'#da6342':'#489ff8',actions:row.linked?[]:[{kind:'edit',label:'Bewerk'},{kind:'delete',label:'Verwijder'}]}));
  if(!visible.length)rows.append(node('p','Nog geen passende notities of lijsten.'));
  const find=id=>visible.find(r=>r.id===id);
  release=bindSwipeRows(rows,{onOpen:id=>{const r=find(id);if(r)(r.linked?openLinked(r.record):openLocal(r.record));},onShare:id=>{const r=find(id);if(r?.linked)openLinked(r.record,true);},onEdit:id=>edit(find(id).record),onDelete:async id=>{const r=find(id);try{await store.put('objects',{...r.record,archivedAt:Date.now()});await loadLocal();}catch(e){report(e);}}});
 }
 async function loadLocal(){local=(await store.getAll('objects')).filter(r=>r.type==='note'&&!r.archivedAt&&!r.deletedAt);paint();}
 search.oninput=paint;
 await loadLocal();
 api.index().then(result=>{if(disposed)return;linked=result.lists;paint();}).catch(e=>{if(!disposed)status.textContent='Notities werken lokaal. Gekoppelde lijsten zijn niet bereikbaar: '+e.message;});
 return ()=>{disposed=true;release();closeBoard();};
}
