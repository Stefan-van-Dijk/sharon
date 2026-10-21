import { IdentifierService } from '../ids/IdentifierService.js?v=0.3.74';

export const CONNECTION_ENDPOINT = 'https://sharon.life/log/api/connections.php';
const PREVIOUS_KEY = 'connection.device.v1';
const KEY = 'connection.device.log-json.v1';
const PENDING = 'connection.pending.log-json.v1';
const APP_URL = 'https://stefan-van-dijk.github.io/sharon/';
const errors = {
  invalid_name:'Vul je naam in om verbinding te maken.',
  invalid_publish_key:'De publicatiesleutel is niet geldig.',
  already_activated:'De eigen installatie is al geactiveerd. Gebruik die installatie om iemand uit te nodigen.',
  invalid_invitation:'Deze uitnodiging is ongeldig of voor een andere identiteit bedoeld.',
  invitation_used:'Deze startcode is al gebruikt.',
  invitation_expired:'Deze code is verlopen. Vraag een nieuwe code.',
  wrong_network:'Deze code hoort bij een ander netwerk.',
  recipient_unknown:'Deze identiteit is nog niet aangemaakt op de server.',
  identity_exists:'Deze identiteit bestaat al. Bewaar je installatiegegevens en neem contact op met de beheerder.',
  depth_limit:'Nieuwe deelnemers kunnen tot en met de derde uitnodigingslijn worden toegevoegd.',
  capacity:'De eerste 100 plaatsen zijn bezet.',
  unauthorized:'Deze netwerkverbinding is niet meer geldig. Ga naar Instellingen → Netwerkverbinding om opnieuw te verbinden.',
  invitation_required:'Je identiteit is aangemaakt. Neem eerst een uitnodiging aan.',
  chat_forbidden:'Deze chat is niet toegankelijk.',
  rate_limit:'Even wachten. Probeer het over een minuut opnieuw.',
  service_unavailable:'De server is niet beschikbaar. Je gegevens blijven op dit toestel.',
  not_configured:'De verbinding moet nog op de server worden ingesteld.'
};

function validInvitation(value) {
  if (!value || value.v !== 1 || !['bootstrap','invite'].includes(value.kind) ||
      !IdentifierService.isValid(value.networkId) || !/^[A-Za-z0-9_-]{43}$/.test(value.token) ||
      !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= 0 ||
      (value.recipientId !== undefined && !IdentifierService.isValid(value.recipientId))) {
    throw Error('Dit is geen geldige Sharon-verbindingscode.');
  }
  // Only these fields are retained. The server address cannot be set by a QR.
  return {v:1,kind:value.kind,networkId:value.networkId,token:value.token,
    expiresAt:value.expiresAt,...(value.recipientId?{recipientId:value.recipientId}:{})};
}
export function parseConnectionLink(input) {
  if (typeof input !== 'string' || input.length > 2000) throw Error('Ongeldige verbindingslink.');
  let url;
  try { url = new URL(input.trim()); } catch { throw Error('Plak de volledige Sharon-verbindingslink.'); }
  if (!['https://stefan-van-dijk.github.io','https://sharon.life','https://www.sharon.life'].includes(url.origin) ||
      url.username || url.password || !/^#connect=[A-Za-z0-9_-]+$/.test(url.hash)) throw Error('Ongeldige verbindingslink.');
  try {
    const encoded = url.hash.slice(9);
    const json = atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));
    return validInvitation(JSON.parse(json));
  } catch { throw Error('Dit is geen geldige Sharon-verbindingscode.'); }
}
export function connectionLink(invitation) {
  const value = validInvitation(invitation);
  return APP_URL+'#connect='+btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function captureConnectionLink(store, locationObject = window.location, historyObject = window.history) {
  if (!locationObject.hash.startsWith('#connect=')) return false;
  const href = locationObject.href;
  // Remove secrets from the visible URL before asynchronous work or onboarding.
  historyObject.replaceState(historyObject.state, '', locationObject.pathname+locationObject.search);
  const invitation = parseConnectionLink(href);
  await store.put('meta', {key:PENDING,value:invitation});
  return true;
}

export class ConnectionService {
  constructor(store, {fetcher = (...args)=>fetch(...args)} = {}) {
    this.store=store; this.fetcher=fetcher;
  }
  async device() {
    const previous = await this.store.get('meta',PREVIOUS_KEY);
    const row = await this.store.getOrCreateMeta(KEY, () => {
      // Preserve the local identity when switching away from the unused SQL relay.
      // Server admission must be confirmed anew by the shared Log JSON endpoint.
      if(previous?.value) return {...previous.value,registered:false,self:null};
      const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
      const deviceToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      return {personId:IdentifierService.create(),deviceToken,registered:false,self:null};
    });
    return row.value;
  }
  async pending() { return (await this.store.get('meta',PENDING))?.value || null; }
  async setPending(value) { await this.store.put('meta',{key:PENDING,value:validInvitation(value)}); }
  async clearPending() { await this.store.delete('meta',PENDING); }
  async request(action, input = {}, device = null, publishKey = '') {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),15000);
    try {
      const response = await this.fetcher(CONNECTION_ENDPOINT, {
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json',...(device?{'X-Log-Access-Token':device.deviceToken}:{}),...(publishKey?{'X-Log-Publish-Key':publishKey}:{})},
        body:JSON.stringify({protocol:'sharon-network-v1',action,...input}),signal:controller.signal
      });
      let data;
      try { data = await response.json(); } catch { throw Error(errors.service_unavailable); }
      if (!response.ok) {
        if(response.status===422 && String(data.error).includes('ConnectionId'))
          throw Error('Het bestaande Log-serverbestand connections.php moet nog worden bijgewerkt.');
        throw Error(errors[data.error] || 'De server kon deze handeling niet uitvoeren.');
      }
      return data;
    } catch (error) {
      if (error.name==='TypeError' || error.name==='AbortError') throw Error(errors.service_unavailable);
      throw error;
    } finally { clearTimeout(timer); }
  }
  async rememberSelf(self) {
    if (!self || !IdentifierService.isValid(self.personId) || !IdentifierService.isValid(self.networkId) ||
        !(self.line===null || (Number.isInteger(self.line)&&self.line>=0&&self.line<=3))) throw Error('Ongeldig serverantwoord.');
    const d = await this.device();
    if (self.personId!==d.personId) throw Error('De server antwoordde voor een andere identiteit.');
    // Durable write finishes before the registration/activation is reported.
    await this.store.setMeta(KEY,{...d,registered:true,self});
    return self;
  }
  async resetNetwork() {
    await this.device();
    await this.store.resetConnectionState(KEY);
    this.connectedContact=null;
  }
  async start(publishKey) {
    if(typeof publishKey!=='string' || publishKey.trim().length<16)throw Error('Vul de bestaande publicatiesleutel in.');
    return validInvitation((await this.request('start',{},null,publishKey.trim())).invitation);
  }
  async register(name) {
    const d = await this.device();
    const data = await this.request('register',{personId:d.personId,deviceToken:d.deviceToken,name:String(name).trim()});
    return this.rememberSelf(data.self);
  }
  async refreshSelf() {
    const d=await this.device();
    if (!d.registered) return null;
    return this.rememberSelf((await this.request('self',{},d)).self);
  }
  async activate(invitation, name) {
    invitation=validInvitation(invitation);
    let d=await this.device();
    if (invitation.recipientId && invitation.recipientId!==d.personId)
      throw Error('Deze uitnodiging is bedoeld voor een andere identiteit. Open hem op het toestel waarop die identiteit is aangemaakt.');
    if (!d.registered) { await this.register(name); d=await this.device(); }
    const data=await this.request(invitation.kind==='bootstrap'?'bootstrap':'accept',
      {networkId:invitation.networkId,token:invitation.token},d);
    const self=await this.rememberSelf(data.self);
    this.connectedContact=data.contact || null;
    if(this.connectedContact)await this.restoreContact(this.connectedContact.personId);
    await this.clearPending();
    return self;
  }
  async invite(recipientId) {
    if(recipientId) IdentifierService.assert(recipientId);
    const result=await this.request('invite',recipientId?{recipientId}:{},await this.device());
    return validInvitation(result.invitation);
  }
  async invitationStatus(invitation) {
    return this.request('invite-status',{token:validInvitation(invitation).token},await this.device());
  }
  contactKey(personId) { return 'connection.contact.'+IdentifierService.assert(personId); }
  async editContact(personId, name) {
    name=String(name).trim();
    if(!name || name.length>80)throw Error('Gebruik een naam van 1 tot 80 tekens.');
    const key=this.contactKey(personId),old=(await this.store.get('meta',key))?.value || {};
    await this.store.setMeta(key,{...old,name});
  }
  async removeContact(personId) {
    const key=this.contactKey(personId),old=(await this.store.get('meta',key))?.value || {};
    await this.store.setMeta(key,{...old,deletedAt:Date.now()});
  }
  async restoreContact(personId) {
    const key=this.contactKey(personId),old=(await this.store.get('meta',key))?.value;
    if(old?.deletedAt)await this.store.setMeta(key,{...old,deletedAt:null});
  }
  async contacts({offline=false}={}) {
    const key='connection.contacts.log-json.v1';
    let contacts;
    if(offline) contacts=(await this.store.get('meta',key))?.value || [];
    else {
      const result=await this.request('contacts',{},await this.device());
      if (!Array.isArray(result.contacts) || result.contacts.some(c=>!IdentifierService.isValid(c.personId)||!IdentifierService.isValid(c.chatId)||typeof c.name!=='string'))
        throw Error('Ongeldig serverantwoord.');
      contacts=result.contacts;
      await this.store.put('meta',{key,value:contacts});
    }
    const visible=await Promise.all(contacts.map(async contact=>{
      const local=(await this.store.get('meta',this.contactKey(contact.personId)))?.value;
      return local?.deletedAt?null:{...contact,name:local?.name||contact.name};
    }));
    return visible.filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'nl')||a.personId.localeCompare(b.personId));
  }
  async cachedMessages(chatId) {
    return (await this.store.getAll('objects')).filter(o=>o.type==='chat-message'&&o.chatId===chatId)
      .sort((a,b)=>(a.seq||Number.MAX_SAFE_INTEGER)-(b.seq||Number.MAX_SAFE_INTEGER)||a.createdAt-b.createdAt);
  }
  async sync(chatId) {
    IdentifierService.assert(chatId);
    let after=(await this.store.get('meta','connection.cursor.'+chatId))?.value || 0;
    // Fetch at most 1000 per refresh; the next refresh resumes at the last seq.
    for(let page=0;page<10;page++) {
      const result=await this.request('messages',{chatId,after},await this.device());
      if(!Array.isArray(result.messages)||result.messages.length>100)throw Error('Ongeldig serverantwoord.');
      const page=[];
      for(const m of result.messages) {
        if(m.chatId!==chatId||!IdentifierService.isValid(m.id)||!IdentifierService.isValid(m.senderId)||
            typeof m.text!=='string'||!Number.isSafeInteger(m.seq)||m.seq<=after)throw Error('Ongeldig serverantwoord.');
        page.push({...m,type:'chat-message',delivery:'sent',createdAt:m.at,updatedAt:m.at});
        after=m.seq;
      }
      await this.store.saveChatMessages(chatId,page,after);
      if(result.messages.length<100)break;
    }
    return this.cachedMessages(chatId);
  }
  async send(chatId, text, retryId = '') {
    IdentifierService.assert(chatId);
    const d=await this.device();
    let message;
    if(retryId) {
      message=await this.store.get('objects',IdentifierService.assert(retryId));
      if(message?.type!=='chat-message'||message.chatId!==chatId||message.senderId!==d.personId||message.delivery==='sent')
        throw Error('Dit bericht kan niet opnieuw worden verstuurd.');
    } else {
      text=String(text);
      if(!text.trim()||new TextEncoder().encode(text).length>8000)throw Error('Gebruik een bericht van maximaal 8000 bytes.');
      let id;
      do { id=IdentifierService.create(); } while(await this.store.get('objects',id));
      message={id,type:'chat-message',chatId,senderId:d.personId,text,
        createdAt:Date.now(),delivery:'pending'};
      await this.store.saveChatMessages(chatId,[message]);
    }
    const result=await this.request('send',{id:message.id,chatId,text:message.text},d);
    const m=result.message;
    if(m?.id!==message.id||m.chatId!==chatId||m.senderId!==d.personId||m.text!==message.text||!Number.isSafeInteger(m.seq))
      throw Error('De ontvangst is niet bevestigd. Je kunt hetzelfde bericht opnieuw proberen.');
    await this.store.saveChatMessages(chatId,[{...message,...m,delivery:'sent',updatedAt:m.at}]);
    return m;
  }
}
