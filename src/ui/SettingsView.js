export function openSettings(root, {
  settings,
  install,
  events,
  onClose
}) {
  const state = settings.get();
  const installState = install.getState();

  root.insertAdjacentHTML('beforeend', `
    <div class="side-menu-backdrop" data-side-backdrop></div>
    <aside class="side-menu" data-side-menu aria-label="Sharon menu">
      <header class="side-menu-header">
        <div class="side-menu-brand" aria-label="Sharon">
          <span>Shar</span>
          <img src="./assets/sharon-mark.png?v=0.1.17" alt="" aria-hidden="true">
          <span>n</span>
        </div>
        <button type="button" class="side-close" data-side-close aria-label="Sluiten">×</button>
      </header>

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
    </aside>
  `);

  const backdrop = root.querySelector('[data-side-backdrop]');
  const menu = root.querySelector('[data-side-menu]');
  const closeButton = root.querySelector('[data-side-close]');
  const profileForm = root.querySelector('[data-profile-form]');
  const installButton = root.querySelector('[data-install-action]');
  const installHelp = root.querySelector('[data-install-help]');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    menu.classList.add('is-visible');
  });

  const close = () => {
    backdrop.classList.remove('is-visible');
    menu.classList.remove('is-visible');

    setTimeout(() => {
      backdrop.remove();
      menu.remove();
      onClose?.();
    }, 220);
  };

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

  const previousClose = close;
  const cleanupAndClose = () => {
    unsubscribeAvailable();
    unsubscribeCompleted();
    previousClose();
  };

  backdrop.onclick = cleanupAndClose;
  closeButton.onclick = cleanupAndClose;
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
