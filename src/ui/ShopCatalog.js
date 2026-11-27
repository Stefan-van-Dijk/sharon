import {IdentifierService} from '../core/ids/IdentifierService.js?v=0.5.26';
import {SHOPLIST_URL,ShopListService} from '../core/shoplist/ShopListService.js?v=0.5.26';
import {mountShopApp} from './ShopApp.js?v=0.5.26';
import {renderObjectStrip} from './ObjectStrip.js?v=0.5.26';
import {bindSwipeRows} from './SwipeRows.js?v=0.5.26';

export function openShopCatalog({store,api=new ShopListService(store),categoryId=null,collectionId=null}={}){
 const doc=globalThis.document,previous=doc.activeElement,dialog=doc.createElement('dialog');
 dialog.className='sh-notes-board sh-catalog-board';
 const node=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
 const button=(label,action)=>{const e=node('button',label);e.type='button';e.onclick=action;return e;};
 const header=node('header'),title=node('h2'),body=node('div'),status=node('p'),navigation=node('nav');
 status.setAttribute('role','status');header.className='sh-notes-brand';
 const brand=node('strong','ShopList.');brand.className='sh-notes-wordmark';header.append(brand,title);navigation.setAttribute('aria-label','Catalogusnavigatie');
 let disposed=false,view=0,cleanup=()=>{},leave=()=>close(),showArchive=false;
 const close=()=>{if(disposed)return;disposed=true;cleanup();dialog.remove();previous?.focus();};
 dialog.append(header,navigation,body,status);doc.body.append(dialog);
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',event=>{event.preventDefault();leave();});dialog.showModal();

 function show(label,back=null){
  cleanup();cleanup=()=>{};const ticket=++view;title.textContent=label;dialog.setAttribute('aria-label',label);body.replaceChildren();status.textContent='';
  leave=back||close;navigation.replaceChildren(button(back?'Terug':'Sluiten',()=>leave()));
  return ()=>!disposed&&view===ticket;
 }
 function run(current,task,label='Laden…'){
  status.textContent=label;
  return Promise.resolve().then(task).then(()=>{if(current())status.textContent='';},error=>{if(current())status.textContent=error.message;});
 }
 function openEditor({id=null,categoryId,collectionId,back=overview}={}){
  show('ShopList',back);
  const frame=mountShopApp(body,id,{api,mode:id?undefined:'catalog',categoryId,collectionId,onReturn:back,registerCleanup:fn=>cleanup=fn});
  leave=()=>{
   if(frame.dataset.returnReady==='true')frame.contentWindow.postMessage({type:'shop:prepare-return'},new URL(SHOPLIST_URL).origin);
   else back();
  };
 }
 function openCategory(category){
  const current=show(category.name,overview);
  const open=button('Open categorie in ShopList',()=>openEditor({categoryId:category.id,back:()=>openCategory(category)}));
  open.className='sh-shop-preview-open';body.append(open,node('h3','Op je boodschappenlijsten'));
  run(current,async()=>{
   const {lists}=await api.library('category-lists',{id:category.id});if(!current())return;
   if(!lists.length){body.append(node('p','Geen producten uit deze categorie op je actieve lijsten.'));return;}
   for(const list of [...lists].sort((a,b)=>a.name.localeCompare(b.name,'nl'))){
    const section=node('section'),lines=node('ul');
    section.append(node('h4',list.name));
    for(const item of list.items)lines.append(node('li',(item.done?'✓ ':'')+item.quantity+' × '+item.name));
    section.append(lines,button('Open lijst in ShopList',()=>openEditor({id:list.id,back:()=>openCategory(category)})));body.append(section);
   }
  });
 }
 function openCollection(collection){
  const current=show(collection.name,overview);
  body.append(node('p',collection.ownerName+' · '+(collection.scope==='all'?'Hele catalogus':'Categorie met subcategorieën')+' · '+collection.products.length+' producten'));
  const open=button('Open in ShopList',()=>openEditor({collectionId:collection.id,back:()=>openCollection(collection)}));open.className='sh-shop-preview-open';body.append(open);
  if(collection.role!=='owner')body.append(node('p',collection.role==='read'?'Je kunt deze inhoud bekijken.':'Je kunt producten toevoegen en weghalen in deze gedeelde catalogus.'));
  else body.append(button('Toegang beheren',()=>access(collection)));
 }
 function access(collection){
  const current=show(collection.name,()=>openCollection(collection));
  run(current,async()=>{
   const {contacts}=await api.library('contacts');if(!current())return;
   body.append(node('p','Wijzigingen en nieuwe inhoud binnen deze selectie worden automatisch gedeeld. Met bewerktoegang kun je producten toevoegen en weghalen uit de gedeelde selectie.'));
   const people=new Map(contacts.map(p=>[p.id,p.name]));
   for(const id of Object.keys(collection.members||{}))if(!people.has(id))people.set(id,id);
   if(!people.size)body.append(node('p','Voeg eerst een persoon toe in Sharon om te delen.'));
   for(const [id,name]of people){
    const label=node('label',name),select=node('select');select.setAttribute('aria-label','Toegang voor '+name);
    for(const [value,text]of [['','Geen toegang'],['read','Bekijken'],['write','Bewerken']]){
     const option=node('option',text);option.value=value;select.append(option);
    }
    select.value=collection.members?.[id]||'';
    select.onchange=()=>{
     const old=collection.members?.[id]||'',role=select.value;select.disabled=true;
     run(current,async()=>{try{
      await api.library('share',{id:collection.id,personId:id,role:role||null});collection.members={...collection.members,[id]:role};
     }catch(error){select.value=old;throw error;}finally{select.disabled=false;}},'Toegang opslaan…');
    };
    label.append(select);body.append(label);
   }
  });
 }
 function shareCategory(id){
  const current=show('Catalogus delen',overview);
  run(current,async()=>{
   const [catalog,index]=await Promise.all([api.catalog(),api.library('index')]);if(!current())return;
   const categories=catalog.catalog.payload.categories.filter(c=>c.name!=='Home');
   const selected=categories.find(c=>c.id===id);
   if(id&&!selected)throw Error('Synchroniseer de categorie in ShopList en probeer opnieuw.');
   const name=node('input');name.value=selected?.name||'Mijn catalogus';name.setAttribute('aria-label','Naam gedeelde catalogus');
   const scope=node('select');scope.setAttribute('aria-label','Inhoud delen');
   const all=node('option','Hele catalogus, inclusief toekomstige toevoegingen');all.value='';scope.append(all);
   for(const c of categories){const option=node('option',c.name+' en subcategorieën');option.value=c.id;scope.append(option);}
   scope.value=id||'';scope.disabled=!!id;
   const create=button('Personen en toegang kiezen',()=>{
    create.disabled=true;run(current,async()=>{try{
     const label=name.value.trim();if(!label)throw Error('Geef je gedeelde catalogus een naam.');
     const scopeValue=scope.value?'branch':'all',roots=scope.value?[scope.value]:[];
     let collection=index.collections.find(c=>c.role==='owner'&&c.scope===scopeValue&&(scopeValue==='all'||(c.roots?.length===1&&c.roots[0]===roots[0])));
     if(!collection){
      const id=IdentifierService.create();await api.library('create',{id,name:label,scope:scopeValue,categories:roots});
      collection=(await api.library('index')).collections.find(c=>c.id===id);
     }
     if(!collection)throw Error('De gedeelde catalogus kon niet worden opgehaald. Probeer opnieuw.');
     if(current())access(collection);
    }finally{create.disabled=false;}},'Selectie opslaan…');
   });
   body.append(name,scope,create);
  });
 }
 function overview(){
  const current=show('Catalogus');
  body.append(button('Open catalogus in ShopList',()=>openEditor()),button('Catalogus delen',()=>shareCategory(null)));
  run(current,async()=>{
   const [catalog,index]=await Promise.all([api.catalog(),api.library('index')]);if(!current())return;
   const archived=new Set(catalog.archivedCategoryIds||[]);
   const categories=catalog.catalog.payload.categories.filter(c=>c.name!=='Home').map(row=>({
    key:'category:'+row.id,row,subtitle:'Categorie',archived:archived.has(row.id),shareable:true,open:()=>openCategory(row),share:()=>shareCategory(row.id),command:'category-archive'
   }));
   const collections=index.collections.filter(row=>row.role!=='owner'||row.scope==='all'||row.roots?.length!==1||!categories.some(c=>c.row.id===row.roots[0])).map(row=>({
    key:'collection:'+row.id,row,subtitle:'Gedeelde catalogus · '+row.ownerName,archived:!!row.archived,shareable:row.role==='owner',open:()=>openCollection(row),share:()=>access(row),command:'collection-archive'
   }));
   const items=[...categories,...collections].sort((a,b)=>a.row.name.localeCompare(b.row.name,'nl'));
   if(!items.some(item=>item.archived))showArchive=false;
   const visible=new Map(items.filter(item=>item.archived===showArchive).map(item=>[item.key,item]));
   const strips=node('div');strips.className='swipe-list';body.append(strips);
   let busy=false;
   for(const item of visible.values())strips.insertAdjacentHTML('beforeend',renderObjectStrip({
    id:item.key,title:item.row.name,subtitle:item.subtitle,accentColor:'#da6342',
    shareable:item.shareable&&!showArchive,singleAction:true,actions:[{kind:'secondary',label:showArchive?'Terugzetten':'Archiveren'}]
   }));
   if(!visible.size)strips.append(node('p',items.length?'Alle categorieën staan in het archief.':'Je catalogus heeft nog geen categorieën. Voeg categorieën toe in ShopList.'));
   cleanup=bindSwipeRows(strips,{
    onOpen:id=>visible.get(id).open(),
    onShare:id=>visible.get(id).share(),
    onSecondary:(id,row)=>{
     if(busy)return;busy=true;const action=row.querySelector('[data-swipe-secondary]');action.disabled=true;
     const item=visible.get(id);
     run(current,async()=>{try{await api.library(item.command,{id:item.row.id,archived:!item.archived});if(current())overview();}
      finally{busy=false;action.disabled=false;}},'Archief bijwerken…');
    }
   });
   if(items.some(item=>item.archived)){
    const slot=node('div');slot.className='sh-notes-archive-slot';slot.append(button(showArchive?'Terug naar catalogus':'Archief · herstellen',()=>{showArchive=!showArchive;overview();}));body.append(slot);
   }
  });
 }
 if(collectionId){
  const current=show('Gedeelde catalogus',overview);
  run(current,async()=>{
   const {collections}=await api.library('index');if(!current())return;
   const collection=collections.find(c=>c.id===collectionId);
   if(!collection)throw Error('Deze gedeelde catalogus is niet beschikbaar.');
   if(collection.role==='owner')access(collection);else openCollection(collection);
  });
 }else if(categoryId)shareCategory(categoryId);else overview();
 return close;
}
