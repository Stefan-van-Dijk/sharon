import { parseLocationPayload, saveReceivedLocation } from './ReceivedObjects.js?v=0.4.15';
import { parseCardPayload } from './CardPayload.js?v=0.4.15';
import { saveReceivedCard } from './CardSharing.js?v=0.4.15';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.4.15';
import { renderListControls, bindListControls, renderOrderControls } from './ListControls.js?v=0.4.15';
import { sortList, moveInOrder, moveToPosition } from '../core/storage/ListOrder.js?v=0.4.15';
import { ChatMonitor } from '../core/connection/ChatMonitor.js?v=0.4.15';
import { renderObjectStrip } from './ObjectStrip.js?v=0.4.15';
import { bindSwipeRows } from './SwipeRows.js?v=0.4.15';
import { ConnectionService, parseConnectionLink, connectionLink } from '../core/connection/ConnectionService.js?v=0.4.15';
import { mountCardScanner } from './CardScanner.js?v=0.4.15';
import { renderCardCode } from './CardCodes.js?v=0.4.15';

const css = '.sh-people{max-width:640px;margin:auto;padding-bottom:32px}.sh-people h2{font-weight:400;font-size:21px}.sh-people p{line-height:1.5}.sh-people label:not(.sh-list-search){display:block;margin:18px 0}.sh-people input:not([data-list-search]),.sh-people textarea{box-sizing:border-box;width:100%;padding:13px;font:inherit;border:1px solid #bbb;border-radius:8px;background:#fff;color:#171717}.sh-people button:not([data-swipe-surface]):not([data-swipe-edit]):not([data-swipe-delete]):not([data-list-sort]):not([data-list-drag]){font:inherit;min-height:44px;padding:10px 14px;border:1px solid #bbb;border-radius:8px;background:#fff;color:#171717;cursor:pointer}.sh-people button:disabled{opacity:.55;cursor:wait}.sh-people [data-swipe-surface]:disabled{opacity:1}.sh-people form button[type=submit]{background:#171717;color:white}.sh-people code{display:block;font-size:19px;letter-spacing:1px;overflow-wrap:anywhere}.sh-chat-messages{display:grid;gap:10px;margin:16px 0;max-height:48dvh;overflow-y:auto}.sh-chat-message{max-width:88%;padding:12px;background:#eee;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere}.sh-chat-message.is-own{justify-self:end;background:#e4eee9}.sh-chat-message small{display:block;white-space:normal;color:#555;font-size:11px;margin-top:6px}.sh-chat-message p{margin:0}.sh-people [data-qr]{max-width:300px;background:#fff;margin:20px auto}.sh-people [role=status]{min-height:24px;color:#555}.sh-people .sh-connection-actions{display:flex;flex-wrap:wrap;gap:8px}';

export function openPeopleView(root, {store,settings,setTitle=()=>{},initialScreen='',onCode=null,chatMonitor=null,headerActions=null,onMembership=()=>{},onOpenObject=null,location=null}) {
  const service = chatMonitor?.service || new ConnectionService(store);
  const monitor=chatMonitor||new ChatMonitor(service);
  const ownsMonitor=!chatMonitor;
  let stopChat=null;
  let disposed=false, generation=0, scanCleanup=null, busy=false, screen='home', chat=null;
  let releaseRows=null, releaseOrder=null, releaseControls=null;
  let query='', prefs={sort:'alpha',order:[]}, contactsCache=[], places=[];
  let nearPosition=location?.latest || null;
  const linkedPlaces=id=>places.filter(p=>p.personIds?.includes(id));
  const distance=contact=>Math.min(Infinity,...linkedPlaces(contact.personId).map(place=>{
    const point=resolveLocation(place,new Map(places.map(p=>[p.id,p]))).coordinates;
    if(!nearPosition||!point)return Infinity;
    const r=Math.PI/180,dy=(point.lat-nearPosition.lat)*r,dx=(point.lng-nearPosition.lng)*r;
    const a=Math.sin(dy/2)**2+Math.cos(point.lat*r)*Math.cos(nearPosition.lat*r)*Math.sin(dx/2)**2;
    return 12742000*Math.asin(Math.min(1,Math.sqrt(a)));
  }));
  const savePrefs=()=>store.put('meta',{key:'people.list.preferences',value:prefs});
  const sortedContacts=()=>sortList(contactsCache.map(c=>({...c,id:c.personId})),{...prefs,distance});
  let self=null, presented=null, checking=false;
  const joined=()=>self?.line!==null&&self?.line!==undefined;
  const name=()=>settings.get().profile?.name || '';
  function frame(title, body, {back=false}={}) {
    if(disposed)return;
    stopChat?.();stopChat=null;headerActions?.replaceChildren();
    releaseRows?.();releaseRows=null;releaseOrder?.();releaseOrder=null;releaseControls?.();releaseControls=null;
    scanCleanup?.(); scanCleanup=null; generation++;
    setTitle(title);
    root.innerHTML='<style>'+css+'</style><section class="module-view sh-people">'+
      (back?'<button type="button" data-navigation-back>‹ Personen</button>':'')+body+
      '<p role="status" aria-live="polite" data-status hidden></p></section>';
    root.querySelectorAll('button').forEach(button=>button.disabled=busy);
    root.querySelector('[data-navigation-back]')?.addEventListener('click',()=>run(home));
  }
  const status = text => { const el=root.querySelector('[data-status]'); if(el&&!disposed){el.textContent=text;el.hidden=!text;} };
  async function run(task) {
    if(busy||disposed)return;
    busy=true;
    const g=generation;
    root.querySelectorAll('button').forEach(b=>b.disabled=true);
    try { await task(); }
    catch(error) { if(!disposed)status(error.message); }
    finally {
      busy=false;
      if(!disposed)root.querySelectorAll('button').forEach(b=>b.disabled=false);
      // A response from a previous screen must never open a new screen after cleanup.
      if(disposed&&g===generation)scanCleanup?.();
    }
  }
  function showMessages(messages, personId) {
    if(disposed)return;
    const host=root.querySelector('[data-messages]'); if(!host)return;
    const nearBottom=host.scrollHeight-host.scrollTop-host.clientHeight<60;
    const scrollTop=host.scrollTop;
    const revision=JSON.stringify(messages.map(m=>[m.id,m.delivery,m.seq]));
    if(host.dataset.revision===revision)return;
    host.dataset.revision=revision;host.replaceChildren();
    for(const m of messages) {
      const article=document.createElement('article'); article.className='sh-chat-message'+(m.senderId===personId?' is-own':'');
      const sharedCard=parseCardPayload(m.text);
      const sharedPlace=parseLocationPayload(m.text);
      const text=document.createElement('p'); text.textContent=sharedCard?'Kaart · '+sharedCard.name:sharedPlace?'Locatie · '+sharedPlace.title:m.text;
      const detail=document.createElement('small');
      detail.textContent=m.delivery==='sent'
        ? (m.senderId===personId?'Verstuurd · ':'Ontvangen · ')+new Date(m.at).toLocaleString('nl-NL')
        : 'Nog niet bevestigd';
      article.append(text,detail);
      if(sharedCard?.location) {
        const place=document.createElement('p');
        place.textContent='Locatie · '+[sharedCard.location.title,sharedCard.location.address].filter(Boolean).join(' · ');
        article.append(place);
      }
      if(sharedPlace&&m.senderId!==personId){const save=document.createElement('button');save.type='button';save.textContent='Bewaar locatie';save.addEventListener('click',()=>run(async()=>{const id=await saveReceivedLocation(store,m);save.textContent='Locatie bewaard';save.disabled=true;}));article.append(save);}
      if(sharedCard&&m.senderId!==personId){
        const save=document.createElement('button');save.type='button';save.dataset.saveSharedCard=m.id;save.textContent=sharedCard.location?'Bewaar kaart en locatie':'Bewaar kaart';save.disabled=busy;
        save.addEventListener('click',()=>run(async()=>{await saveReceivedCard(store,m);save.textContent='Kaart bewaard';save.disabled=true;status(sharedCard.location?'Kaart en gekoppelde locatie bewaard.':'Kaart bewaard bij Kaarten.');}));
        article.append(save);
      }
      if(m.delivery!=='sent') {
        const retry=document.createElement('button');retry.type='button';retry.textContent='Opnieuw proberen';retry.disabled=busy;
        retry.addEventListener('click',()=>run(async()=>{await service.send(chat.chatId,'',m.id);monitor.activity();await updateChat();}));
        article.append(retry);
      }
      host.append(article);
    }
    if(!messages.length)host.textContent='Er zijn nog geen berichten.';
    host.scrollTop=nearBottom?host.scrollHeight:scrollTop;
  }
  async function updateChat() {
    if(disposed||!chat)return;
    await monitor.refreshActive();
  }
  async function openChat(contact) {
    if(disposed)return;
    screen='chat';chat=contact;
    frame(contact.name,'<div data-messages class="sh-chat-messages" aria-label="Berichten"></div>'+
      '<form data-message-form><label>Bericht<textarea name="message" maxlength="4000" rows="3" required></textarea></label>'+
      '<button type="submit">Verstuur</button></form>',{back:true});
    const form=root.querySelector('form');
    form.addEventListener('submit',event=>{
      event.preventDefault();
      run(async()=>{
        const text=form.elements.message.value;
        // Keep the draft until an acknowledgement or a saved pending record exists.
        try { await service.send(contact.chatId,text); form.reset(); }
        catch(error) {
          const saved=await service.cachedMessages(contact.chatId);
          if(saved.some(m=>m.delivery==='pending'&&m.text===text))form.reset();
          showMessages(saved,(await service.device()).personId);
          throw error;
        }
        monitor.activity();await updateChat();
      });
    });
    const {personId}=await service.device();
    if(disposed||chat!==contact)return;
    stopChat=monitor.watchChat(contact.chatId,{onMessages:messages=>showMessages(messages,personId),onError:status});
    const cached=await service.cachedMessages(contact.chatId);
    if(disposed||chat!==contact)return;
    showMessages(cached,personId);
    if(!document.hidden)await service.markRead(contact.chatId,cached);
    await monitor.refreshUnread();
    await updateChat();
  }
  async function ownerStart() {
    if(disposed)return;screen='owner-start';chat=null;
    frame('Eigen installatie activeren','<p>Gebruik eenmalig de bestaande publicatiesleutel van Log om jouw startcode te maken.</p>'+
      '<form data-owner-start><label>Publicatiesleutel<input name="key" type="password" autocomplete="off" minlength="16" required></label>'+
      '<button type="submit">Maak eenmalige startcode</button></form>'+
      '<p>De sleutel wordt niet bewaard en komt niet in de QR-code. Je bevestigt de activatie in de volgende stap.</p>',{back:true});
    root.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();
      const field=event.currentTarget.elements.key;
      let key=field.value;field.value='';
      run(async()=>{
        let invitation;
        try { invitation=await service.start(key); }
        finally { key=''; }
        await service.setPending(invitation);
        if(!disposed)await confirm(invitation);
      });
    });
  }
  async function checkInvitation() {
    if(disposed||screen!=='invite'||!presented||checking)return;
    checking=true;const g=generation;
    try {
      const result=await service.invitationStatus(presented);
      if(disposed||g!==generation)return;
      if(result.claimed) {
        await service.restoreContact(result.contact.personId);
        const contacts=await service.contacts();
        if(!disposed&&g===generation)await openChat(contacts.find(c=>c.personId===result.contact.personId)||result.contact);
      }
      else if(result.expired)status('Deze code is verlopen. Maak een nieuwe verbinding.');
    } finally { checking=false; }
  }
  async function invitationScreen() {
    if(disposed)return;screen='invite';chat=null;
    frame('Verbinding maken','<p>Laat de ander deze QR-code in Sharon scannen. Daarmee geef je toegang en wisselen jullie je naam uit.</p>'+
      '<div data-qr></div><p data-waiting>Verbinding voorbereiden…</p>'+
      '<button type="button" data-copy-invite>Kopieer contactcode</button>'+
      '<button type="button" data-check-invite>Verbinding controleren</button>',{back:true});
    const g=generation;
    presented=await service.invite();
    if(disposed||g!==generation)return;
    const compact=await service.compactInvitation(presented);
    if(disposed||g!==generation)return;
    const url=connectionLink(compact);
    root.querySelector('[data-waiting]').textContent='Wachten op de ander. Deze code werkt één keer en is 24 uur geldig.';
    root.querySelector('[data-copy-invite]').addEventListener('click',()=>run(async()=>{
      await navigator.clipboard.writeText(url);status('Contactcode gekopieerd.');
    }));
    root.querySelector('[data-check-invite]').addEventListener('click',()=>run(checkInvitation));
    try { await renderCardCode(root.querySelector('[data-qr]'),'QR_CODE',url); }
    catch { status('De QR-code kon niet laden. Je kunt de contactcode kopiëren.'); }
  }
  async function connect(invitation, displayName=name()) {
    const g=generation;
    self=await service.activate(invitation,displayName);
    onMembership(true);
    if(disposed||g!==generation)return;
    if(['invite','code'].includes(invitation.kind)) {
      const contacts=await service.contacts();
      if(disposed||g!==generation)return;
      const peer=contacts.find(c=>c.chatId===service.connectedContact?.chatId);
      if(peer)return openChat(peer);
      if(contacts.length===1)return openChat(contacts[0]);
    }
    await home();
  }
  async function confirm(invitation) {
    if(disposed)return;screen='confirm';chat=null;
    const device=await service.device();
    if(disposed)return;
    frame('Verbinden', '<h2>'+(invitation.kind==='bootstrap'?'Eigen installatie activeren':'Uitnodiging aannemen')+'</h2>'+
      '<p>Je maakt verbinding met sharon.life. Je naam en identiteit worden daar vastgelegd.</p>'+
      (!name()?'<label>Jouw naam<input data-display-name maxlength=80 required></label>':'')+
      '<p>Geldig tot <span data-expiry></span>.</p><button type="button" data-accept>Verbinden met Sharon</button>'+
      '<button type="button" data-cancel>Code verwijderen</button>'+
      '<p><button type="button" data-show-start-qr>Toon deze code als QR</button></p><div data-qr></div>',{back:true});
    root.querySelector('[data-expiry]').parentElement.textContent=invitation.kind==='code'
      ? 'Eenmalige contactcode. De server controleert of de uitnodiging nog geldig is.'
      : 'Geldig tot '+new Date(invitation.expiresAt).toLocaleString('nl-NL')+'.';
    root.querySelector('[data-accept]').addEventListener('click',()=>run(async()=>{
      await connect(invitation,root.querySelector('[data-display-name]')?.value.trim()||name());
    }));
    root.querySelector('[data-show-start-qr]').addEventListener('click',()=>run(async()=>{
      await renderCardCode(root.querySelector('[data-qr]'),'QR_CODE',connectionLink(invitation));
    }));
    root.querySelector('[data-cancel]').addEventListener('click',()=>run(async()=>{await service.clearPending();await home();}));
    if(invitation.recipientId&&invitation.recipientId!==device.personId) {
      root.querySelector('[data-accept]').hidden=true;
      status('Deze uitnodiging hoort bij een andere identiteit. Open hem op het oorspronkelijke toestel.');
    }
  }
  function renderContacts(contacts) {
    if(disposed||screen!=='home'||!joined())return;
    const host=root.querySelector('[data-contacts]');if(!host)return;
    contactsCache=contacts;
    const ordered=sortedContacts();
    const revision=JSON.stringify([prefs.sort,ordered,places.map(p=>[p.id,p.data?.title,p.personIds])]);
    if(host.dataset.revision===revision)return;
    host.dataset.revision=revision;
    releaseRows?.();releaseRows=null;releaseOrder?.();releaseOrder=null;
    host.innerHTML=contacts.length?ordered.map(contact=>'<div class="sh-list-item" data-list-item>'+renderObjectStrip({
      module:'persons',id:contact.personId,title:contact.name,
      subtitle:linkedPlaces(contact.personId).map(p=>p.data?.title||'Locatie').join(' · '),
      trailingHtml:'<span class="sh-notification-dot" data-contact-unread role="img" aria-label="Ongelezen berichten" '+(contact.unread?'':'hidden')+'></span><span class="sh-location-chevron" aria-hidden="true">›</span>'
    })+(prefs.sort==='custom'?renderOrderControls(contact.personId):'')+'</div>').join(''):'<p>Je hebt nog geen contacten. Nodig iemand uit.</p>';
    applySearch();
    const reorder=async order=>{prefs={...prefs,order};await savePrefs();renderContacts(contactsCache);};
    releaseOrder=bindListControls(host,{
      onMove:(id,direction)=>reorder(moveInOrder(sortedContacts().map(c=>c.id),id,direction)),
      onMoveTo:(id,targetId,after)=>reorder(moveToPosition(sortedContacts().map(c=>c.id),id,targetId,after))
    });
    const byId=new Map(contacts.map(contact=>[contact.personId,contact]));
    releaseRows=bindSwipeRows(host,{
      onOpen:id=>run(()=>openChat(byId.get(id))),
      onEdit:id=>run(()=>editContact(byId.get(id))),
      onDelete:id=>run(async()=>{
        const contact=byId.get(id);
        if(!window.confirm('Wil je '+contact.name+' uit jouw contacten verwijderen?'))return;
        await service.removeContact(id);await monitor.refreshUnread();await home();
      })
    });
    if(busy)host.querySelectorAll('button').forEach(button=>button.disabled=true);
  }
  function applySearch() {
    const q=query.trim().toLocaleLowerCase('nl');
    let visible=0;
    root.querySelectorAll('[data-contacts] [data-swipe-row]').forEach(row=>{
      const contact=contactsCache.find(c=>c.personId===row.dataset.swipeRow);
      const hidden=Boolean(q)&&![contact?.name,...linkedPlaces(contact?.personId).map(p=>p.data?.title)].join(' ').toLocaleLowerCase('nl').includes(q);
      row.closest('[data-list-item]').hidden=hidden;
      if(!hidden)visible++;
    });
    const empty=root.querySelector('[data-search-empty]');if(empty)empty.hidden=!contactsCache.length||visible>0;
  }
  async function loadContacts() {
    const g=generation;
    await monitor.refreshUnread();
    const contacts=await service.contacts();
    if(disposed||g!==generation)return;
    await monitor.refreshUnread(contacts);monitor.report('');status('');
  }
  async function editContact(contact) {
    if(disposed)return;screen='edit';chat=null;
    frame('Persoon bewerken','<form data-contact-form><label>Naam in jouw contacten<input name="name" maxlength="80" required></label>'+
      '<button type="submit">Opslaan</button></form><div data-contact-links></div>',{back:true});
    const form=root.querySelector('[data-contact-form]');form.elements.name.value=contact.name;
    form.addEventListener('submit',event=>{
      event.preventDefault();run(async()=>{await service.editContact(contact.personId,form.elements.name.value);await home();});
    });
    const linked=(await store.getAll('objects')).filter(item=>!item.deletedAt&&!item.archivedAt&&item.status!=='archived'&&['card','location'].includes(item.type)&&item.personIds?.includes(contact.personId));
    if(disposed||!form.isConnected)return;
    const links=root.querySelector('[data-contact-links]');
    if(linked.length) {
      const heading=document.createElement('h2');heading.textContent='Gekoppelde onderdelen';links.append(heading);
      for(const item of linked) {
        const button=document.createElement(onOpenObject?'button':'p');
        button.textContent=(item.type==='card'?'Kaarten':'Locaties')+' · '+(item.name||item.data?.title||'Zonder naam');
        if(onOpenObject){button.type='button';button.addEventListener('click',()=>onOpenObject(item));}
        links.append(button);
      }
    }

  }
  function scan({autoStart=false}={}) {
    if(disposed)return;
    frame('Code scannen','');screen='scan';
    scanCleanup=mountCardScanner(root,{autoStart,onClose:()=>run(home),onResult:result=>run(async()=>{
      const {value}=result;
      if(onCode&&!await service.isConnectionScan(result)) { await onCode(result);return; }
      frame('Verbinden','<p>Code lezen…</p>');
      const invitation=parseConnectionLink(value);
      await service.setPending(invitation);
      await receive(await service.pending());
    })});
    root.querySelector('[data-scan-close]').textContent='‹ Terug';
  }
  async function receive(invitation) {
    // Scanning within Sharon is the deliberate connection action. Opening an
    // external link still asks for confirmation before exchanging information.
    if(['invite','code'].includes(invitation.kind)&&name()) {
      frame('Verbinden','<p>Verbinding maken…</p>');screen='connecting';
      await connect(invitation);
    } else await confirm(invitation);
  }
  async function home() {
    if(disposed)return;screen='home';chat=null;presented=null;
    const device=await service.device();self=device.self;
    if(disposed)return;
    if(joined()) {
      prefs=(await store.get('meta','people.list.preferences'))?.value || {sort:'alpha',order:[]};
      places=(await store.getAll('objects')).filter(o=>o.type==='location'&&!o.deletedAt);
      if(prefs.sort==='near'&&!nearPosition)prefs={...prefs,sort:'alpha'};
      if(disposed)return;
      frame('Personen',renderListControls({placeholder:'Zoek een persoon',query,sort:prefs.sort,near:true})+'<div class="swipe-list" data-contacts></div><p data-search-empty hidden>Geen personen gevonden.</p>');
      releaseControls=bindListControls(root.querySelector('.sh-list-controls'),{
        onSearch:value=>{query=value;applySearch();},
        onSort:mode=>run(async()=>{
          if(mode==='near'){
            if(!contactsCache.some(c=>linkedPlaces(c.personId).some(p=>resolveLocation(p,new Map(places.map(p=>[p.id,p]))).coordinates))){status('Koppel eerst een persoon aan een locatie met GPS.');return;}
            try {nearPosition=await location.checkNow({reason:'people-near',maxAgeMs:60_000,highAccuracy:false});}
            catch {status('Locatietoegang nodig om personen op afstand te sorteren.');return;}
          }
          status('');
          prefs={...prefs,sort:mode,order:mode==='custom'&&!prefs.order?.length?sortedContacts().map(c=>c.id):prefs.order};
          await savePrefs();
          if(disposed||screen!=='home')return;
          root.querySelectorAll('[data-list-sort]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.listSort===mode)));
          renderContacts(contactsCache);
        })
      });
      const add=document.createElement('button');add.type='button';add.className='sh-location-header-add';
      add.dataset.invite='';add.setAttribute('aria-label','Verbinding maken');add.textContent='+';
      add.addEventListener('click',()=>run(invitationScreen));
      if(headerActions)headerActions.append(add);else root.querySelector('.sh-people').prepend(add);
      await loadContacts();
    } else {
      frame('Verbinden','<p>Scan de QR-code van iemand in het netwerk om verbinding te maken.</p>'+
        '<button type="button" data-scan>QR-code scannen</button>'+
        '<details><summary>Contactcode gebruiken</summary><form data-link-form><label>Contactcode of bestaande verbindingslink<textarea name="link" required></textarea></label><button type="submit">Verbinden</button></form></details>'+
        '<details><summary>Eerste installatie</summary><button type="button" data-owner-start-button>Eigen installatie activeren</button></details>');
      root.querySelector('[data-scan]').addEventListener('click',scan);
      root.querySelector('[data-owner-start-button]').addEventListener('click',()=>run(ownerStart));
      root.querySelector('[data-link-form]').addEventListener('submit',event=>{
        event.preventDefault();const value=event.currentTarget.elements.link.value;
        run(async()=>{const invitation=parseConnectionLink(value);await service.setPending(invitation);await confirm(await service.pending());});
      });
    }
  }
  async function initialize() {
    const pending=await service.pending();
    if(disposed)return;
    if(initialScreen==='owner-start')await ownerStart();
    else if(initialScreen==='scan'||initialScreen==='camera')scan({autoStart:initialScreen==='camera'});
    else if(pending) { if(initialScreen==='scanned')await receive(pending);else await confirm(pending); }
    else await home();
  }
  const unsubscribe=monitor.subscribe(state=>{
    if(screen==='home'&&joined()){renderContacts(state.contacts);status(state.error);}
  });
  if(ownsMonitor)monitor.start();
  run(initialize);
  const invitationPoll=setInterval(()=>{
    if(!disposed&&!document.hidden&&!busy&&screen==='invite')run(checkInvitation);
  },3000);
  return ()=>{disposed=true;generation++;clearInterval(invitationPoll);scanCleanup?.();releaseRows?.();releaseOrder?.();releaseControls?.();stopChat?.();unsubscribe();headerActions?.replaceChildren();if(ownsMonitor)monitor.stop();};
}
