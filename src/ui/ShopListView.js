import {ShopListService,SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.4.75';
export async function openShopListView(outlet,{store}){
 const api=new ShopListService(store);
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 outlet.replaceChildren();const title=node('h2','ShopList'),status=node('p','Lijsten ophalen…'),rows=node('div');outlet.append(title,status,rows);
 const create=node('a','Open ShopList om een lijst te verbinden');create.href=SHOPLIST_URL;outlet.append(create);
 try{
  const [{lists},contacts]=await Promise.all([api.index(),api.connection.contacts()]);
  status.textContent=lists.length?'Dezelfde lijsten in Sharon en ShopList.':'Nog geen verbonden boodschappenlijsten.';
  for(const list of lists){
   const row=node('section'),link=node('a',list.name);link.href=SHOPLIST_URL+'?shoplist='+encodeURIComponent(list.id);row.append(link);
   if(list.role==='owner'){
    const details=node('details'),summary=node('summary','Delen en toegang');details.append(summary);
    const response=await api.read(list.id);
    for(const contact of contacts){
     const label=node('label',contact.name+' '),select=node('select');
     for(const [value,title]of [['','Geen toegang'],['read','Bekijken'],['write','Bewerken']]){const option=node('option',title);option.value=value;select.append(option);}
     select.value=response.list.members[contact.personId]||'';
     let previous=select.value;
     select.onchange=async()=>{select.disabled=true;try{await api.share(list.id,contact.personId,select.value||null);previous=select.value;status.textContent='Deelrechten bijgewerkt.';}catch(e){select.value=previous;status.textContent=e.message;}finally{select.disabled=false;}};
     label.append(select);details.append(label,node('br'));
    }
    row.append(details);
   }
   rows.append(row);
  }
 }catch(e){status.textContent='ShopList-verbinding nog niet beschikbaar. '+e.message;}
 return ()=>{};
}
