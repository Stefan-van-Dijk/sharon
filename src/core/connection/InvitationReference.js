const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export function isInvitationReference(value) {
  return value?.kind==='reference' && /^[A-Za-z0-9_-]{12}$/.test(value.id) && /^[A-Za-z0-9_-]{43}$/.test(value.key);
}
export async function sealInvitation(invitation) {
  const secret=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await crypto.subtle.importKey('raw',secret,'AES-GCM',false,['encrypt']);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(invitation)));
  return {key:encode(secret),payload:{v:1,iv:encode(iv),data:encode(new Uint8Array(bytes))}};
}
export async function unsealInvitation(reference,payload) {
  if(!isInvitationReference(reference)||payload?.v!==1||!/^[A-Za-z0-9_-]{16}$/.test(payload.iv)||
    typeof payload.data!=='string'||payload.data.length>3000||!/^[A-Za-z0-9_-]+$/.test(payload.data))throw Error('Ongeldige contactcode.');
  try {
    const key=await crypto.subtle.importKey('raw',decode(reference.key),'AES-GCM',false,['decrypt']);
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv)},key,decode(payload.data));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {throw Error('De contactcode kon niet worden geopend.');}
}
