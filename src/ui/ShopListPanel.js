// The selected shared list remains the only write target. Catalogue choices belong
// to the authenticated Sharon identity; only selected products enter the list.
export function mountShopListPanel({body,response,api,isCurrent=()=>body.isConnected,onUpdated=()=>{}}){
 const document=body.ownerDocument;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,action)=>{const n=node('button',text);n.type='button';n.onclick=action;return n;};
 let record=structuredClone(response.list),role=response.role,tab='list',catalog=null,catalogError='',pending=null,busy=false,message='';
 const writable=()=>['owner','write'].includes(role);
 const uid=()=>globalThis.crypto.randomUUID();
 const shell=node('section');shell.className='sh-shop-panel';body.replaceChildren(shell);
 function selectedProduct(payload,source){
  let product=payload.products.find(p=>p.catalogSourceId===source.id);
  if(!product)product=payload.products.find(p=>p.id===source.id&&p.name===source.name&&p.categoryId===source.categoryId);
  if(product)return product.id;
  const category=catalog.categories.find(c=>c.id===source.categoryId);if(!category)throw Error('De productcategorie ontbreekt.');
  let target=payload.categories.find(c=>c.catalogSourceId===category.id)||payload.categories.find(c=>c.id===category.id&&c.name===category.name);
  if(!target){target={id:payload.categories.some(c=>c.id===category.id)?uid():category.id,name:category.name,entries:[],catalogSourceId:category.id};payload.categories.push(target);}
  product={...structuredClone(source),id:payload.products.some(p=>p.id===source.id)?uid():source.id,categoryId:target.id,catalogSourceId:source.id};payload.products.push(product);return product.id;
 }
 function add(payload,source,quantity=1,note=''){
  const productId=selectedProduct(payload,source),existing=payload.list.items.find(i=>i.productId===productId&&!i.done&&i.note===note);
  if(existing)existing.quantity+=quantity;else payload.list.items.push({id:uid(),productId,quantity,note,done:false});
 }
 async function send(){
  if(!pending||busy||!isCurrent())return;busy=true;message='Bewaren…';paint();
  try{const result=await api.write(pending.payload,pending.revision,pending.operation);if(!isCurrent())return;record=structuredClone(result.list);role=result.role||role;pending=null;message='Bewaard.';onUpdated(result);}
  catch(error){if(!isCurrent())return;message=error.message||'Bewaren mislukt.';if(error.code==='list_conflict'||error.status===409)message='De lijst is ondertussen gewijzigd. Haal de actuele lijst op en voer je wijziging opnieuw uit.';}
  finally{busy=false;if(isCurrent())paint();}
 }
 function change(edit){if(!writable()||busy||pending||!isCurrent())return;try{const payload=structuredClone(record.payload);edit(payload);pending={payload,revision:record.revision,operation:uid()};send();}catch(error){message=error.message;paint();}}
 async function reload(){if(busy)return;busy=true;paint();try{const result=await api.read(record.payload.list.id);if(!isCurrent())return;if(result.list.payload.list.id!==record.payload.list.id)throw Error('Onjuiste lijst ontvangen.');record=structuredClone(result.list);role=result.role;pending=null;message='Actuele lijst opgehaald.';onUpdated(result);}catch(error){message=error.message;}finally{busy=false;if(isCurrent())paint();}}
 function paint(){
  if(!isCurrent())return;shell.replaceChildren();const tabs=node('nav');tabs.setAttribute('aria-label','ShopList onderdelen');
  for(const [key,label]of (writable()?[['list','Lijst'],['products','Producten'],['recipes','Gerechten'],['activities','Activiteiten']]:[['list','Lijst']])){const b=button(label,()=>{tab=key;paint();});b.setAttribute('aria-pressed',String(tab===key));tabs.append(b);}shell.append(tabs);
  const content=node('div'),status=node('p',message);status.setAttribute('role','status');shell.append(content,status);
  const blocked=!writable()||busy||!!pending;
  if(tab==='list'){
   const products=new Map(record.payload.products.map(p=>[p.id,p]));
   for(const item of record.payload.list.items){const row=node('label'),check=node('input'),quantity=node('input');check.type='checkbox';check.checked=item.done;check.disabled=blocked;check.setAttribute('aria-label','Afstrepen '+(products.get(item.productId)?.name||'Product'));check.onchange=()=>change(p=>{p.list.items.find(i=>i.id===item.id).done=check.checked;});quantity.type='number';quantity.min='0.01';quantity.step='any';quantity.value=item.quantity;quantity.disabled=blocked;quantity.setAttribute('aria-label','Aantal '+(products.get(item.productId)?.name||'Product'));quantity.onchange=()=>{const value=Number(quantity.value);if(!Number.isFinite(value)||value<=0){message='Vul een positief aantal in.';paint();return;}change(p=>{p.list.items.find(i=>i.id===item.id).quantity=value;});};row.className='sh-notes-check';row.append(check,node('span',products.get(item.productId)?.name||'Product'),quantity);if(item.note)row.append(node('small',item.note));content.append(row);}
   if(!record.payload.list.items.length)content.append(node('p','Deze lijst is nog leeg. Kies producten, gerechten of activiteiten.'));
  }else if(!catalog){content.append(node('p',catalogError||'Keuzes ophalen…'));}
  else{
   const choices=tab==='products'?catalog.products:catalog.recipes.filter(r=>(r.kind==='activity')===(tab==='activities'));
   for(const choice of choices){const row=node('div'),select=button('Toevoegen',()=>change(payload=>{if(tab==='products')add(payload,choice);else for(const ingredient of choice.ingredients){const product=catalog.products.find(p=>p.id===ingredient.productId);if(!product)throw Error('Een product uit deze keuze ontbreekt.');add(payload,product,ingredient.quantity,ingredient.note||'');}}));select.disabled=blocked;select.setAttribute('aria-label',choice.name+' toevoegen');row.append(node('span',choice.name),select);content.append(row);}
   if(!choices.length)content.append(node('p','Nog geen keuzes. Bewaar je producten, gerechten en activiteiten in de gekoppelde ShopList-app.'));
  }
  if(!writable())shell.append(node('p','Je kunt deze lijst bekijken.'));
  if(pending){const retry=button('Opnieuw bewaren',send),fresh=button('Wijziging laten vervallen en lijst ophalen',reload);retry.disabled=fresh.disabled=busy;shell.append(retry,fresh);}
 }
 paint();
 if(writable())Promise.resolve().then(()=>api.catalog()).then(result=>{if(!isCurrent())return;catalog=result.catalog?.payload||{products:[],categories:[],recipes:[]};paint();}).catch(error=>{if(!isCurrent())return;catalogError=error.message||'Keuzes konden niet worden opgehaald.';paint();});
 return {reload,beforeLeave(){if(busy){message='Wacht tot de wijziging is bewaard.';paint();return false;}if(pending)return document.defaultView.confirm('Deze wijziging is nog niet bewaard. Wil je deze laten vervallen en teruggaan?');return true;}};
}
