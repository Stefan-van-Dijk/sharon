// Only a temporary invitation enters the clipboard.
export function openShopPairing(connection){
 const dialog=document.createElement('dialog');dialog.className='sh-notes-board';dialog.setAttribute('aria-label','Verbinden met ShopList');
 const heading=document.createElement('h2');heading.textContent='Verbinden met ShopList';const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Koppelcode maken…';
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;};
 let closed=false,invitation;const request=async(action,input={})=>connection.request('shop-pair-'+action,input,await connection.device());
 const code=request('create',{format:'compact'}).then(r=>{invitation=r;return r.code;});code.catch(()=>{});
 const instruction=()=>{if(!closed)status.textContent='Code gekopieerd. Open ShopList. Tik op het Sharon-logo en kies Koppelen met Sharon.';};
 const retry=button('Kopieer koppelcode',()=>copy());retry.hidden=true;
 async function copy(){retry.disabled=true;try{if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){await navigator.clipboard.write([new ClipboardItem({'text/plain':code.then(text=>new Blob([text],{type:'text/plain'}))})]);}else await navigator.clipboard.writeText(await code);instruction();retry.hidden=true;}catch(e){if(!closed){status.textContent='Kies Kopieer koppelcode om verder te gaan. '+e.message;retry.hidden=false;}}finally{retry.disabled=false;}}
 let polling=false;async function refresh(){if(closed||polling||document.hidden||!invitation)return;polling=true;try{const result=await request('list');if(!closed&&result.devices.some(d=>d.id===invitation.id&&d.status==='active')){status.textContent='ShopList verbonden. Je lijsten worden bijgewerkt in Sharon.';clearInterval(timer);}}catch{}finally{polling=false;}}
 const timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',refresh);const close=()=>{if(closed)return;closed=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);dialog.remove();};dialog.addEventListener('close',close,{once:true});
 dialog.append(heading,status,retry,button('Sluiten',close));document.body.append(dialog);dialog.showModal();copy();return close;
}
