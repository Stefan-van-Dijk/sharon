import { demoWorkspace, setDemoEnabled } from '../core/skeleton/SkeletonCore.js?v=0.3.42';
export function openSettings(root, {
  settings,
  install,
  events,
  settingsStore = null,
  store = null
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

  if (store) {
    const demoToggle = root.querySelector('[data-skeleton-toggle]');
    demoWorkspace(store).then(({enabled}) => { if (demoToggle.isConnected) demoToggle.checked=enabled; });
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
