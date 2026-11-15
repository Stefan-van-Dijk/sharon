// No permanent credential leaves Sharon. Only an expiring invitation is copied.
export function openShopPairing(connection){
 const dialog=document.createElement('dialog');dialog.className='sh-notes-board';dialog.setAttribute('aria-label','Shop verbinden');
 const heading=document.createElement('h2');heading.textContent='Shop verbinden';const body=document.createElement('div');body.className='sh-notes-body';const status=document.createElement('p');status.setAttribute('role','status');
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};return b;};
 const request=async(action,input={})=>connection.request('shop-pair-'+action,input,await connection.device());
 let signature=null,invitation=null;let closed=false,polling=false;const onVisible=()=>{if(!document.hidden)refresh().catch(()=>{});};const timer=setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},5000);document.addEventListener('visibilitychange',onVisible);const close=()=>{if(closed)return;closed=true;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);dialog.remove();};dialog.addEventListener('close',close,{once:true});
 const showCode=r=>{const code=document.createElement('input');code.value=r.code;code.readOnly=true;code.setAttribute('aria-label','Tijdelijke koppelcode');body.append(code,button('Kopieer code',async()=>{await navigator.clipboard.writeText(r.code);status.textContent='Gekopieerd. Druk in Shop op het Sharon-logo en kies Koppelen met Sharon.';}));status.textContent='Zeven dagen geldig, tot Shop de koppeling succesvol heeft opgeslagen.';};
 const refresh=async()=>{if(polling||closed)return;polling=true;let result;try{result=await request('list');}finally{polling=false;}if(closed)return;const next=JSON.stringify(result.devices);if(next===signature)return;signature=next;body.replaceChildren();
  const info=document.createElement('p');info.textContent='Met deze code geef je één Shop-installatie toegang tot je boodschappenlijsten. Kopieer de code en druk in Shop op het Sharon-logo. Lokale lijsten worden niet automatisch gedeeld.';body.append(info);
  body.append(button('Koppelcode maken',async()=>{const r=await request('create',{format:'compact'});if(closed)return;invitation=r;showCode(r);}));
  if(invitation&&result.devices.some(d=>d.id===invitation.id&&d.status!=='active')&&invitation.expiresAt>Date.now())showCode(invitation);else {if(invitation&&result.devices.some(d=>d.id===invitation.id&&d.status==='active'))status.textContent='Koppeling geslaagd: Shop heeft de verbinding opgeslagen.';invitation=null;}
  for(const r of result.devices){const row=document.createElement('div');const text=document.createElement('p');text.textContent=r.status==='active'?'Shop verbonden · '+r.fingerprint:r.status==='ready'?'Shop rondt het opslaan van de koppeling af':r.status==='claimed'?'Controlecode '+r.fingerprint+' — komt deze overeen met Shop?':'Wacht op koppelen in Shop';row.append(text);
   if(r.status==='claimed'&&!r.compact)row.append(button('Ja, deze Shop verbinden',async()=>{await request('confirm',{id:r.id,fingerprint:r.fingerprint});status.textContent='Verbonden. Klik in Shop op Verbinding controleren.';await refresh();}));
   row.append(button(r.status==='active'?'Verbinding intrekken':'Annuleren',async()=>{await request('revoke',{id:r.id});await refresh();}));body.append(row);
  }
 };
 dialog.append(heading,body,status,button('Vernieuwen',refresh),button('Sluiten',close));document.body.append(dialog);dialog.showModal();refresh().catch(e=>{if(!closed)status.textContent=e.message;});return close;
}
