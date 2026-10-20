import { ConnectionService, parseConnectionLink, connectionLink } from '../core/connection/ConnectionService.js?v=0.3.71';
import { mountCardScanner } from './CardScanner.js?v=0.3.71';
import { renderCardCode } from './CardCodes.js?v=0.3.71';

const css = '.sh-people{max-width:640px;margin:auto;padding-bottom:32px}.sh-people h2{font-weight:400;font-size:21px}.sh-people p{line-height:1.5}.sh-people label{display:block;margin:18px 0}.sh-people input,.sh-people textarea{box-sizing:border-box;width:100%;padding:13px;font:inherit;border:1px solid #bbb;border-radius:8px;background:#fff;color:#171717}.sh-people button{font:inherit;min-height:44px;padding:10px 14px;border:1px solid #bbb;border-radius:8px;background:#fff;color:#171717;cursor:pointer}.sh-people button:disabled{opacity:.55;cursor:wait}.sh-people form button[type=submit]{background:#171717;color:white}.sh-people code{display:block;font-size:19px;letter-spacing:1px;overflow-wrap:anywhere}.sh-people [data-contacts] button{display:block;width:100%;text-align:left;margin:8px 0}.sh-chat-messages{display:grid;gap:10px;margin:16px 0;max-height:48dvh;overflow-y:auto}.sh-chat-message{max-width:88%;padding:12px;background:#eee;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere}.sh-chat-message.is-own{justify-self:end;background:#e4eee9}.sh-chat-message small{display:block;white-space:normal;color:#555;font-size:11px;margin-top:6px}.sh-chat-message p{margin:0}.sh-people [data-qr]{max-width:300px;background:#fff;margin:20px auto}.sh-people [role=status]{min-height:24px;color:#555}.sh-people .sh-connection-actions{display:flex;flex-wrap:wrap;gap:8px}';

export function openPeopleView(root, {store,settings,setTitle=()=>{}}) {
  const service = new ConnectionService(store);
  let disposed=false, generation=0, scanCleanup=null, poll=null, busy=false, screen='home', chat=null;
  let self=null;
  const name=()=>settings.get().profile?.name || '';
  function frame(title, body, {back=false}={}) {
    if(disposed)return;
    scanCleanup?.(); scanCleanup=null; generation++;
    setTitle(title);
    root.innerHTML='<style>'+css+'</style><section class="module-view sh-people">'+
      (back?'<button type="button" data-navigation-back>‹ Personen</button>':'')+body+
      '<p role="status" aria-live="polite" data-status></p></section>';
    root.querySelector('[data-navigation-back]')?.addEventListener('click',()=>run(home));
  }
  const status = text => { const el=root.querySelector('[data-status]'); if(el&&!disposed)el.textContent=text; };
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
    host.replaceChildren();
    for(const m of messages) {
      const article=document.createElement('article'); article.className='sh-chat-message'+(m.senderId===personId?' is-own':'');
      const text=document.createElement('p'); text.textContent=m.text;
      const detail=document.createElement('small');
      detail.textContent=m.delivery==='sent'
        ? (m.senderId===personId?'Verstuurd · ':'Ontvangen · ')+new Date(m.at).toLocaleString('nl-NL')
        : 'Nog niet bevestigd';
      article.append(text,detail);
      if(m.delivery!=='sent') {
        const retry=document.createElement('button');retry.type='button';retry.textContent='Opnieuw proberen';
        retry.addEventListener('click',()=>run(async()=>{await service.send(chat.chatId,'',m.id);await updateChat();}));
        article.append(retry);
      }
      host.append(article);
    }
    if(!messages.length)host.textContent='Er zijn nog geen berichten.';
    host.scrollTop=host.scrollHeight;
  }
  async function updateChat() {
    const selected=chat, g=generation;
    if(disposed||!selected)return;
    const messages=await service.sync(selected.chatId);
    if(disposed||generation!==g)return;
    showMessages(messages,(await service.device()).personId);
    status('Bijgewerkt.');
  }
  async function openChat(contact) {
    if(disposed)return;
    screen='chat';chat=contact;
    frame(contact.name,'<div data-messages class="sh-chat-messages" aria-label="Berichten"></div>'+
      '<button type="button" data-refresh-chat>Berichten verversen</button>'+
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
        await updateChat();
      });
    });
    root.querySelector('[data-refresh-chat]').addEventListener('click',()=>run(updateChat));
    showMessages(await service.cachedMessages(contact.chatId),(await service.device()).personId);
    await updateChat();
  }
  async function invitationScreen() {
    if(disposed)return;screen='invite';chat=null;
    frame('Iemand uitnodigen','<p>Laat de ander eerst in Personen een identiteit aanmaken. Vul daarna diens identiteit in.</p>'+
      '<form data-invite-form><label>Identiteit van de ander<input name="recipient" minlength="12" maxlength="12" pattern="[A-Za-z0-9_-]{12}" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>'+
      '<button type="submit">Maak uitnodiging</button></form><div data-invitation></div>',{back:true});
    root.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();
      const id=event.currentTarget.elements.recipient.value.trim();
      run(async()=>{
        const invitation=await service.invite(id);
        if(disposed)return;
        const url=connectionLink(invitation);
        const host=root.querySelector('[data-invitation]');if(!host)return;
        host.innerHTML='<p>Deze uitnodiging werkt alleen voor de gekozen identiteit en is 24 uur geldig.</p>'+
          '<div data-qr></div><label>Uitnodigingslink<textarea readonly rows="3"></textarea></label>'+
          '<button type="button" data-copy-invite>Kopieer uitnodiging</button>';
        host.querySelector('textarea').value=url;
        host.querySelector('button').addEventListener('click',()=>run(async()=>{
          await navigator.clipboard.writeText(url);status('Uitnodiging gekopieerd.');
        }));
        try { await renderCardCode(host.querySelector('[data-qr]'),'QR_CODE',url); }
        catch { status('De QR-code kon niet laden. Je kunt de uitnodigingslink gebruiken.'); }
      });
    });
  }
  async function confirm(invitation) {
    if(disposed)return;screen='confirm';chat=null;
    const device=await service.device();
    if(disposed)return;
    frame('Verbinden', '<h2>'+(invitation.kind==='bootstrap'?'Eigen installatie activeren':'Uitnodiging aannemen')+'</h2>'+
      '<p>Je maakt verbinding met sharon.life. Je naam en identiteit worden daar vastgelegd.</p>'+
      '<p>Identiteit van dit toestel:</p><code data-person-id></code>'+
      '<p>Geldig tot <span data-expiry></span>.</p><button type="button" data-accept>Verbinden met Sharon</button>'+
      '<button type="button" data-cancel>Code verwijderen</button>'+
      '<p><button type="button" data-show-start-qr>Toon deze code als QR</button></p><div data-qr></div>',{back:true});
    root.querySelector('[data-person-id]').textContent=device.personId;
    root.querySelector('[data-expiry]').textContent=new Date(invitation.expiresAt).toLocaleString('nl-NL');
    root.querySelector('[data-accept]').addEventListener('click',()=>run(async()=>{
      self=await service.activate(invitation,name());if(!disposed)await home();
    }));
    root.querySelector('[data-show-start-qr]').addEventListener('click',()=>run(async()=>{
      await renderCardCode(root.querySelector('[data-qr]'),'QR_CODE',connectionLink(invitation));
    }));
    root.querySelector('[data-cancel]').addEventListener('click',()=>run(async()=>{await service.clearPending();await home();}));
    if(invitation.kind==='invite'&&invitation.recipientId!==device.personId) {
      root.querySelector('[data-accept]').hidden=true;
      status('Deze uitnodiging hoort bij een andere identiteit. Open hem op het oorspronkelijke toestel.');
    }
  }
  async function loadContacts() {
    const g=generation;
    const render=contacts=>{
      if(disposed||g!==generation)return;
      const host=root.querySelector('[data-contacts]');if(!host)return;
      host.replaceChildren();
      if(!contacts.length)host.textContent='Je hebt nog geen contacten. Nodig iemand uit.';
      for(const contact of contacts) {
        const button=document.createElement('button');button.type='button';button.textContent=contact.name;
        button.addEventListener('click',()=>run(()=>openChat(contact)));host.append(button);
      }
    };
    render(await service.contacts({offline:true}));
    render(await service.contacts());
    if(g===generation)status('Verbonden met Sharon.');
  }
  async function home() {
    if(disposed)return;screen='home';chat=null;
    const device=await service.device();self=device.self;
    if(disposed)return;
    frame('Personen','<p data-connection-state></p><p>Jouw identiteit op dit toestel:</p><code data-person-id></code>'+
      '<p>Bewaar deze installatie. Voor dezelfde identiteit op een ander toestel is nog geen overdracht beschikbaar.</p>'+
      '<div class="sh-connection-actions"><button type="button" data-copy-id>Kopieer identiteit</button>'+
      (!device.registered?'<button type="button" data-register>Identiteit aanmaken</button>':'')+
      (self?.line!==null&&self?.line!==undefined?'<button type="button" data-invite>Iemand uitnodigen</button>':'')+
      '</div><div data-contacts></div><hr>'+
      '<form data-link-form><label>Startlink of uitnodigingslink<textarea name="link" rows="3" required autocomplete="off"></textarea></label>'+
      '<button type="submit">Code bekijken</button></form><p><button type="button" data-scan>QR-code scannen</button></p>'+
      (device.registered?'<button type="button" data-refresh>Verbinding verversen</button>':'')+
      '<p>Berichten gaan via een beveiligde verbinding. De server kan de inhoud lezen.</p>');
    root.querySelector('[data-person-id]').textContent=device.personId;
    root.querySelector('[data-connection-state]').textContent=!device.registered
      ?'Maak eerst je identiteit aan om een persoonlijke uitnodiging te kunnen ontvangen.'
      :self?.line===null?'Je identiteit is aangemaakt. Neem een uitnodiging aan.'
      :self?.line===0?'Eigen installatie geactiveerd.':'Toegang actief · uitnodigingslijn '+self?.line+'.';
    root.querySelector('[data-copy-id]').addEventListener('click',()=>run(async()=>{
      await navigator.clipboard.writeText(device.personId);status('Identiteit gekopieerd.');
    }));
    root.querySelector('[data-register]')?.addEventListener('click',()=>run(async()=>{
      self=await service.register(name());await home();
    }));
    root.querySelector('[data-invite]')?.addEventListener('click',()=>run(invitationScreen));
    root.querySelector('[data-refresh]')?.addEventListener('click',()=>run(async()=>{
      self=await service.refreshSelf();await home();
    }));
    root.querySelector('[data-link-form]').addEventListener('submit',event=>{
      event.preventDefault();
      const value=event.currentTarget.elements.link.value;
      run(async()=>{const invitation=parseConnectionLink(value);await service.setPending(invitation);await confirm(invitation);});
    });
    root.querySelector('[data-scan]').addEventListener('click',()=>{
      if(busy)return;
      generation++;screen='scan';
      scanCleanup=mountCardScanner(root,{onClose:()=>run(home),onResult:({value})=>run(async()=>{
        // Restore a screen with a status region before reporting parse errors.
        await home().catch(error=>status(error.message));const invitation=parseConnectionLink(value);
        await service.setPending(invitation);await confirm(invitation);
      })});
      root.querySelector('[data-scan-close]').textContent='‹ Personen';
    });
    if(device.registered&&self?.line!==null)await loadContacts();
  }
  async function initialize() {
    const pending=await service.pending();
    if(disposed)return;
    if(pending)await confirm(pending);
    else await home();
  }
  initialize().catch(error=>status(error.message));
  // Live updates while this view is visible. No requests from Home or demo mode.
  // 60s interval also bounds traffic on mobile networks.
  poll=setInterval(()=>{
    if(disposed||document.hidden||busy)return;
    if(screen==='chat')run(updateChat);
    else if(screen==='home'&&self?.line!==null&&self?.line!==undefined)run(loadContacts);
  },60000);
  return ()=>{disposed=true;generation++;clearInterval(poll);scanCleanup?.();};
}
