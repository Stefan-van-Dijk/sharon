import {ConnectionService} from '../core/connection/ConnectionService.js?v=0.4.22';
import {mountGraphInspector} from './GraphInspector.js?v=0.4.22';
import { demoWorkspace, setDemoEnabled } from '../core/skeleton/SkeletonCore.js?v=0.4.22';
export function openSettings(root, {
  settings,
  install,
  events,
  settingsStore = null,
  store = null,
  onNetworkReset=()=>{},
  resetNetwork=null,
  onNetworkStart=()=>{}
}) {
  const state = settings.get();
  const installState = install.getState();

  root.innerHTML = `
    <section class="module-view settings-page">
      <section class="settings-section">
        <span class="settings-kicker">Gegevens</span>

        <form class="settings-form" data-profile-form>
          <label class="clean-field settings-field">
            <span>Naam</span>
            <input
              name="name"
              type="text"
              maxlength="80"
              autocomplete="name"
              value="${escapeAttribute(state.profile?.name || '')}"
              required
            >
          </label>
          <button type="submit" class="settings-save">Bewaar</button>
        </form>
      </section>

      ${store?`<section class="settings-section">
        <span class="settings-kicker">Netwerkverbinding</span>
        <div class="privacy-principle" data-network-role>
          <strong data-role-label>Rol ophalen…</strong>
          <small data-role-description></small>
          <small role="status" data-role-confirmation></small>
        </div>
        <button type="button" class="settings-row" data-check-role disabled><span>Rol controleren</span><span class="settings-arrow">›</span></button>
        <button type="button" class="settings-row" data-reset-network>
          <span><strong>Opnieuw instellen</strong><small>Wis de netwerkverbinding, contacten en chatberichten op dit toestel. Behoud kaarten, locaties en profiel.</small></span><span class="settings-arrow">›</span>
        </button>
        <p role="status" aria-live="polite" data-network-status></p>
        <button type="button" class="settings-row" data-start-network hidden>
          <span><strong>Eigen netwerk starten</strong><small>Alleen voor de eerste installatie. Andere deelnemers scannen jouw QR.</small></span><span class="settings-arrow">›</span>
        </button>
      </section>`:''}

      <section class="settings-section privacy-section">
        <span class="settings-kicker">Privacy & delen</span>

        <div class="privacy-principles">
          <div class="privacy-principle">
            <strong>Lokaal als standaard</strong>
            <small>Gegevens blijven op dit apparaat totdat jij bewust iets deelt of overdraagt.</small>
          </div>

          <div class="privacy-principle">
            <strong>Eerst zien, dan delen</strong>
            <small>Sharon laat vóór verzending zien welke gegevens je gaat delen.</small>
          </div>

          <div class="privacy-principle">
            <strong>Niet-herleidbare sleutel</strong>
            <small>Deelcodes en identifiers bevatten zelf geen naam, adres of andere betekenisvolle persoonsgegevens.</small>
          </div>
        </div>

        <p class="privacy-note">
          Inhoud die je bewust deelt kan wel persoonlijke informatie bevatten.
          Sharon vraagt daarom altijd eerst om bevestiging.
        </p>
      </section>

      <section class="settings-section">
        <span class="settings-kicker">Testen / ontwikkeling</span>
        <label class="settings-row" for="sh-skeleton-test-toggle">
          <span><strong>Testomgeving gebruiken</strong><small>Wissel de volledige app naar afzonderlijke voorbeeldgegevens.</small></span>
          <input id="sh-skeleton-test-toggle" data-skeleton-toggle type="checkbox" aria-label="Testomgeving gebruiken">
        </label>
        <p class="privacy-note" data-skeleton-explanation>Je eigen gegevens blijven bewaard. De app herstart in de gekozen omgeving.</p>
        <details class="sh-graph-settings" data-graph-settings hidden><summary>Graphinspectie</summary><div data-graph-inspector></div></details>

        <button type="button" class="settings-row" data-reset-onboarding>
          <span><strong>Onboarding opnieuw starten</strong><small>Behoud locaties en overige gegevens.</small></span>
          <span class="settings-arrow">›</span>
        </button>
        <button type="button" class="settings-row" data-reset-all>
          <span><strong>Sharon volledig resetten</strong><small>Wis alle lokale gegevens en begin opnieuw.</small></span>
          <span class="settings-arrow">›</span>
        </button>
      </section>

      <section class="settings-section">
        <span class="settings-kicker">Webapp</span>

        <button type="button" class="settings-row" data-install-action ${installState.installed ? 'disabled' : ''}>
          <span>
            <strong>${installState.installed ? 'Sharon is geïnstalleerd' : 'Installeer Sharon'}</strong>
            <small>${installDescription(installState)}</small>
          </span>
          ${installState.installed ? '' : '<span class="settings-arrow">›</span>'}
        </button>

        <div class="install-help" data-install-help hidden></div>
      </section>
    </section>
  `;

  let disposed=false;
  const roleService=store?new ConnectionService(store):null;
  async function renderRole(verified=false){
    if(!roleService)return;
    const device=await roleService.device();
    const host=root.querySelector('[data-network-role]');if(disposed||!host?.isConnected)return;
    const line=device.self?.line;
    const owner=device.registered&&line===0;
    const member=device.registered&&Number.isInteger(line)&&line>0;
    host.querySelector('[data-role-label]').textContent=owner?'Jouw rol: Beheerder':member?'Jouw rol: Deelnemer':device.registered?'Nog geen netwerktoegang':'Niet verbonden met een netwerk';
    host.querySelector('[data-role-description]').textContent=owner?'Je gebruikt de identiteit van de netwerkeigenaar. Je kunt de relevantie van boards beheren.':member?'Je bent via een uitnodiging verbonden. De netwerkeigenaar beheert de relevantie van boards.':'Je hebt op dit toestel geen actieve netwerkrol. Deelname vereist een geldige uitnodiging of startcode.';
    host.querySelector('[data-role-confirmation]').textContent=device.registered?(verified?'Door de server bevestigd.':'Laatst bekende rol op dit toestel.') : '';
    root.querySelector('[data-check-role]').disabled=!device.registered;
  }
  renderRole().catch(()=>{});
  root.querySelector('[data-check-role]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    const status=root.querySelector('[data-role-confirmation]');status.textContent='Rol controleren…';
    try{await roleService.refreshSelf();await renderRole(true);}
    catch{if(!disposed&&status.isConnected)status.textContent='Niet te controleren. De laatst bekende rol blijft zichtbaar; de server controleert je beheerrechten bij elke wijziging.';}
    finally{if(!disposed&&button.isConnected)button.disabled=false;}
  });

  root.querySelector('[data-reset-network]')?.addEventListener('click',async event=>{
    if(!window.confirm('Netwerkverbinding opnieuw instellen? De contacten en chatberichten op dit toestel worden gewist. Kaarten, locaties en profiel blijven behouden.'))return;
    const button=event.currentTarget;button.disabled=true;
    const status=root.querySelector('[data-network-status]');
    try {
      await (resetNetwork?resetNetwork():new ConnectionService(store).resetNetwork());
      onNetworkReset();
      await renderRole();
      if(!status.isConnected)return;
      status.textContent='Opnieuw ingesteld. Start als eerste je eigen netwerk, of ga terug naar Home en scan de QR van de eigenaar.';
      root.querySelector('[data-start-network]').hidden=false;
    } catch(error) { if(status.isConnected)status.textContent=error.message; }
    finally {if(button.isConnected)button.disabled=false;}
  });
  root.querySelector('[data-start-network]')?.addEventListener('click',()=>onNetworkStart());

  if (store) {
    const demoToggle = root.querySelector('[data-skeleton-toggle]');
    demoWorkspace(store).then(({enabled}) => {
      if (!demoToggle.isConnected) return;
      demoToggle.checked=enabled;
      const inspector=root.querySelector('[data-graph-settings]');
      inspector.hidden=!enabled;
      inspector.addEventListener('toggle',()=>{
        if(inspector.open) mountGraphInspector(root.querySelector('[data-graph-inspector]'),store).catch(()=>{
          root.querySelector('[data-graph-inspector]').textContent='Graphinspectie is niet beschikbaar.';
        });
      });
    });
    demoToggle.addEventListener('change',async event => {
      demoToggle.disabled=true;
      try {
        await setDemoEnabled(store,event.target.checked);
        window.location.reload();
      } catch {
        demoToggle.checked=!event.target.checked;
        demoToggle.disabled=false;
        root.querySelector('[data-skeleton-explanation]').textContent='Omschakelen is niet gelukt. Probeer het opnieuw.';
      }
    });
  }
  const profileForm = root.querySelector('[data-profile-form]');
  const installButton = root.querySelector('[data-install-action]');
  const installHelp = root.querySelector('[data-install-help]');
  const resetOnboarding = root.querySelector('[data-reset-onboarding]');
  const resetAll = root.querySelector('[data-reset-all]');

  profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const name = String(new FormData(profileForm).get('name') || '').trim();
    if (!name) return;

    await settings.update({ profile: { name } });
    const button = profileForm.querySelector('.settings-save');
    button.textContent = 'Bewaard';
    setTimeout(() => {
      if (button.isConnected) button.textContent = 'Bewaar';
    }, 1200);
  });

  resetOnboarding?.addEventListener('click', async () => {
    if (!confirm('Onboarding opnieuw starten? Je locaties en overige gegevens blijven bewaard.')) return;
    await settings.update({ onboarding: { storySeen: false, firstModule: '', firstPlaceId: '' } });
    window.location.reload();
  });

  resetAll?.addEventListener('click', async () => {
    if (!confirm('Sharon volledig resetten? Alle lokaal opgeslagen gegevens op dit apparaat worden gewist.')) return;
    if (!confirm('Weet je het zeker? Dit kan niet ongedaan worden gemaakt.')) return;
    const databases = await indexedDB.databases?.();
    if (databases?.length) {
      await Promise.all(databases.filter(db => db.name === 'sharon').map(db => new Promise(resolve => {
        const request = indexedDB.deleteDatabase(db.name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      })));
    } else {
      indexedDB.deleteDatabase('sharon');
    }
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('sharon-')).map(key => caches.delete(key)));
    }
    window.location.reload();
  });

  const unsubscribeAvailable = events.on('install.available', () => {
    const current = install.getState();
    if (current.installed || !installButton?.isConnected) return;
    installButton.querySelector('small').textContent = installDescription(current);
  });

  const unsubscribeCompleted = events.on('install.completed', () => {
    if (!installButton?.isConnected) return;
    installButton.disabled = true;
    installButton.querySelector('strong').textContent = 'Sharon is geïnstalleerd';
    installButton.querySelector('small').textContent = 'Op dit apparaat';
    installHelp.hidden = true;
  });

  installButton?.addEventListener('click', async () => {
    if (install.isInstalled()) return;

    const result = await install.prompt();

    if (result.outcome === 'accepted' || result.outcome === 'installed') {
      installButton.disabled = true;
      installButton.querySelector('strong').textContent = 'Sharon is geïnstalleerd';
      installButton.querySelector('small').textContent = 'Op dit apparaat';
      installHelp.hidden = true;
      return;
    }

    renderManualInstallHelp(installHelp, result);
  });

  return () => {
    disposed=true;
    unsubscribeAvailable();
    unsubscribeCompleted();
  };
}

function installDescription(state) {
  if (state.installed) return 'Op dit apparaat';
  if (state.canPrompt) return 'Open Sharon als zelfstandige app';
  if (state.ios) return 'Zet Sharon op je beginscherm';
  return 'Open Sharon als zelfstandige webapp';
}

function renderManualInstallHelp(container, state) {
  container.hidden = false;

  if (state.ios) {
    container.innerHTML = state.safari
      ? `
        <p>Op iPhone of iPad:</p>
        <ol>
          <li>Tik onderin Safari op <strong>Deel</strong>.</li>
          <li>Kies <strong>Zet op beginscherm</strong>.</li>
          <li>Kies <strong>Voeg toe</strong>.</li>
        </ol>
      `
      : `
        <p>Open Sharon eerst in Safari.</p>
        <ol>
          <li>Tik in Safari op <strong>Deel</strong>.</li>
          <li>Kies <strong>Zet op beginscherm</strong>.</li>
          <li>Kies <strong>Voeg toe</strong>.</li>
        </ol>
      `;
    return;
  }

  container.innerHTML = `
    <p>Gebruik de installatieoptie van je browser om Sharon als zelfstandige webapp toe te voegen.</p>
  `;
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
