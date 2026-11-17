import {IdentifierService} from '../core/ids/IdentifierService.js?v=0.5.06';
import {ShopListService} from '../core/shoplist/ShopListService.js?v=0.5.06';
import {mountShopApp} from './ShopApp.js?v=0.5.06';

// Sharing decisions stay in Sharon. Shop supplies only a requested category or collection.
export function openShopCatalog({store,api=new ShopListService(store),categoryId=null,collectionId=null}={}){
 const doc=globalThis.document,previous=doc.activeElement,dialog=doc.createElement('dialog');
 dialog.className='sh-notes-board sh-catalog-board';dialog.setAttribute('aria-label','Catalogus');
 const node=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
 const button=(label,action)=>{const e=node('button',label);e.type='button';e.onclick=action;return e;};
 const title=node('h2','Catalogus'),body=node('div'),status=node('p');status.setAttribute('role','status');let disposed=false,cleanup=()=>{};
 const close=()=>{if(disposed)return;disposed=true;cleanup();dialog.remove();previous?.focus();};
 dialog.append(title,button('Sluiten',close),body,status);doc.body.append(dialog);dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();
 const run=async task=>{status.textContent='Laden…';try{await task();if(!disposed)status.textContent='';}catch(e){if(!disposed)status.textContent=e.message;}};
 const access=async collection=>{
  body.replaceChildren();title.textContent=collection.name;
  body.append(node('p',collection.ownerName+' · '+(collection.scope==='all'?'Hele catalogus':'Categorietak')+' · '+collection.products.length+' producten'));
  if(collection.role!=='owner'){body.append(node('p',collection.role==='read'?'Je kunt deze inhoud bekijken.':'Je kunt producten toevoegen en weghalen in deze gedeelde catalogus.'));body.append(button('Open in ShopList',openEditor));return;}
  const {contacts}=await api.library('contacts');if(disposed)return;
  body.append(node('p','Wijzigingen en nieuwe inhoud binnen deze selectie worden automatisch gedeeld. Bewerken geeft toegang om producten aan de gedeelde selectie toe te voegen of eruit te halen.'));
  const people=new Map(contacts.map(p=>[p.id,p.name]));for(const id of Object.keys(collection.members||{}))if(!people.has(id))people.set(id,id);
  if(!people.size)body.append(node('p','Voeg eerst een persoon toe in Sharon om te delen.'));
  for(const [id,name]of people){const label=node('label',name),select=node('select');select.setAttribute('aria-label','Toegang voor '+name);
   for(const [value,text]of [['','Geen toegang'],['read','Bekijken'],['write','Bewerken']]){const option=node('option',text);option.value=value;select.append(option);}select.value=collection.members?.[id]||'';
   select.onchange=()=>{const old=collection.members?.[id]||'',role=select.value;select.disabled=true;run(async()=>{try{await api.library('share',{id:collection.id,personId:id,role:role||null});collection.members={...collection.members,[id]:role};}catch(e){select.value=old;throw e;}finally{select.disabled=false;}});};label.append(select);body.append(label);
  }
  body.append(button('Terug naar catalogi',()=>run(load)));
 };
 function openEditor(){cleanup();body.replaceChildren();title.textContent='Catalogus onderhouden';mountShopApp(body,null,{api,mode:'catalog',registerCleanup:fn=>cleanup=fn});}
 async function load(){
  cleanup();cleanup=()=>{};title.textContent='Catalogus';body.replaceChildren();
  const [catalog,index]=await Promise.all([api.catalog(),api.library('index')]);if(disposed)return;
  const selected=index.collections.find(c=>c.id===collectionId);if(selected){collectionId=null;await access(selected);return;}
  body.append(button('Mijn catalogus onderhouden',openEditor));
  const name=node('input');name.value='Mijn catalogus';name.setAttribute('aria-label','Naam gedeelde catalogus');
  const scope=node('select');scope.setAttribute('aria-label','Inhoud delen');
  const all=node('option','Hele catalogus, inclusief toekomstige toevoegingen');all.value='';scope.append(all);
  for(const c of catalog.catalog.payload.categories.filter(c=>c.name!=='Home')){const o=node('option',c.name+' en subcategorieën');o.value=c.id;scope.append(o);}
  if(categoryId){if(![...scope.options].some(o=>o.value===categoryId))throw Error('Deze categorie is nog niet beschikbaar in Sharon. Synchroniseer de catalogus in ShopList en probeer opnieuw.');scope.value=categoryId;}
  body.append(node('h3','Delen'),name,scope);
  const create=button('Personen en toegang kiezen',()=>{create.disabled=true;run(async()=>{try{
   if(!name.value.trim())throw Error('Geef je gedeelde catalogus een naam.');
   const scopeValue=scope.value?'branch':'all',categories=scope.value?[scope.value]:[];
   let existing=index.collections.find(c=>c.role==='owner'&&c.scope===scopeValue&&(scopeValue==='all'||JSON.stringify(c.roots)===JSON.stringify(categories)));
   if(!existing){const id=IdentifierService.create();await api.library('create',{id,name:name.value.trim(),scope:scopeValue,categories});existing=(await api.library('index')).collections.find(c=>c.id===id);}
   await access(existing);
  }finally{create.disabled=false;}});});body.append(create,node('h3','Gedeelde catalogi'));
  for(const collection of index.collections)body.append(button(collection.name+' · '+collection.ownerName,()=>run(()=>access(collection))));
 }
 run(load);return close;
}
