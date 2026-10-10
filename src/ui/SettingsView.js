import { createEnvironmentAppearanceEditor } from './EnvironmentAppearanceEditor.js?v=0.1.65';

export function openSettings(root, {
  settings,
  install,
  events,
  store
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
        <span class="settings-kicker">Kaartweergave</span>
        <p class="settings-map-intro">
          Stel de kleuren, lijnen en zichtbaarheid per schaalniveau in voor Omgeving.
          De instellingen blijven lokaal en zijn later altijd terug te zetten.
        </p>
        <div data-map-style-settings></div>
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

  const cleanupAppearance = createEnvironmentAppearanceEditor(root, store);
  const profileForm = root.querySelector('[data-profile-form]');
  const installButton = root.querySelector('[data-install-action]');
  const installHelp = root.querySelector('[data-install-help]');

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
    cleanupAppearance();
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
