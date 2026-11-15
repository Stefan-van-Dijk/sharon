// No permanent credential leaves Sharon. Only an expiring invitation is copied.
export function openShopPairing(connection){
 const dialog=document.createElement('dialog');dialog.className='sh-notes-board';dialog.setAttribute('aria-label','Shop verbinden');
 const heading=document.createElement('h2');heading.textContent='Shop verbinden';const body=document.createElement('div');body.className='sh-notes-body';const status=document.createElement('p');status.setAttribute('role','status');
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};return b;};
 const request=async(action,input={})=>connection.request('shop-pair-'+action,input,await connection.device());
 let closed=false;const close=()=>{closed=true;dialog.remove();};dialog.addEventListener('close',close,{once:true});
 const refresh=async()=>{const result=await request('list');if(closed)return;body.replaceChildren();
  const info=document.createElement('p');info.textContent='Maak een tijdelijke code, plak die in Shop en bevestig hier dezelfde controlecode. Je deelt hiermee nog geen lokale lijsten.';body.append(info);
  body.append(button('Koppelcode maken',async()=>{const r=await request('create');if(closed)return;const code=document.createElement('input');code.value=r.code;code.readOnly=true;code.setAttribute('aria-label','Tijdelijke koppelcode');body.append(code,button('Kopieer code',async()=>{await navigator.clipboard.writeText(r.code);status.textContent='Gekopieerd. Plak de code binnen vijf minuten in Shop.';}));code.select();status.textContent='Vijf minuten geldig. Keer na het plakken terug en klik op Vernieuwen.';}));
  for(const r of result.devices){const row=document.createElement('div');const text=document.createElement('p');text.textContent=r.status==='active'?'Shop verbonden · '+r.fingerprint:r.status==='claimed'?'Controlecode '+r.fingerprint+' — komt deze overeen met Shop?':'Wacht op plakken in Shop';row.append(text);
   if(r.status==='claimed')row.append(button('Ja, deze Shop verbinden',async()=>{await request('confirm',{id:r.id,fingerprint:r.fingerprint});status.textContent='Verbonden. Klik in Shop op Verbinding controleren.';await refresh();}));
   row.append(button(r.status==='active'?'Verbinding intrekken':'Annuleren',async()=>{await request('revoke',{id:r.id});await refresh();}));body.append(row);
  }
 };
 dialog.append(heading,body,status,button('Vernieuwen',refresh),button('Sluiten',close));document.body.append(dialog);dialog.showModal();refresh().catch(e=>{if(!closed)status.textContent=e.message;});return close;
}
