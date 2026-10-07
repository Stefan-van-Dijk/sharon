import { openLocationsView } from './LocationsView.js?v=0.1.23';
import { openSettings } from './SettingsView.js?v=0.1.23';
import { sharonLogo, sharonWordmark } from './Brand.js?v=0.1.23';
import { bindSwipeHome } from './SwipeHome.js?v=0.1.23';

const NAV_MS = 340;

export function createShell(root, {
  modules,
  location,
  events,
  store,
  settings,
  install,
  initialModule = '',
  initialLocationId = '',
  revealFromLogo = false
}) {
  const list = modules.list();
  let triggerTimer = null;

  root.innerHTML = `
    <main class="shell">
      <header class="brand">
        <div class="brand-line">
          ${sharonWordmark({
            mode: 'sharon',
            className: `home-brand-vector ${revealFromLogo ? 'is-from-logo' : ''}`,
            dataHook: 'data-home-brand',
            label: 'Sharon'
          })}
          <span
            class="location-pulse is-searching"
            data-location-status
            title="Locatie wordt bepaald"
            aria-label="Locatie wordt bepaald"
          ></span>
        </div>
      </header>

      <div class="trigger-toast" data-trigger-toast hidden></div>

      <nav class="module-list" aria-label="Onderdelen">
        ${list.map(module => `
          <button class="module-row" data-module="${module.id}">
            <span>${module.title}</span>
            ${chevron()}
          </button>
        `).join('')}

        <button class="module-row settings-home-row" data-settings>
          <span>Instellingen</span>
          ${chevron()}
        </button>
      </nav>

      <footer class="shell-footer">
        <span class="location-state" data-message>Locatie wordt bij openen gecontroleerd.</span>
        <button type="button" class="quiet-action" data-location-check>Ververs locatie</button>
      </footer>
    </main>
  `;

  const message = root.querySelector('[data-message]');
  const status = root.querySelector('[data-location-status]');
  const toast = root.querySelector('[data-trigger-toast]');
  const homeBrand = root.querySelector('[data-home-brand]');

  if (revealFromLogo) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => homeBrand?.classList.remove('is-from-logo'));
    });
  }

  const setSearching = () => {
    if (!status?.isConnected) return;
    status.classList.remove('is-ready');
    status.classList.add('is-searching');
    status.title = 'Locatie wordt bepaald';
    status.setAttribute('aria-label', 'Locatie wordt bepaald');
  };

  const setReady = () => {
    if (!status?.isConnected) return;
    status.classList.remove('is-searching');
    status.classList.add('is-ready');
    status.title = 'Locatie beschikbaar';
    status.setAttribute('aria-label', 'Locatie beschikbaar');
  };

  const unsubscribeLocation = events.on('location.changed', event => {
    if (!message?.isConnected) return;
    setReady();
    const accuracy = Math.round(event.detail?.accuracy ?? 0);
    message.textContent = accuracy
      ? `Locatie beschikbaar · ±${accuracy} m`
      : 'Locatie beschikbaar';
  });

  const unsubscribeTrigger = events.on('trigger.fired', event => {
    if (!toast?.isConnected) return;

    if (triggerTimer) clearTimeout(triggerTimer);
    toast.textContent = event.detail?.message || 'Locatietrigger geactiveerd.';
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    triggerTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (toast.isConnected) toast.hidden = true;
      }, 240);
    }, 4200);
  });

  const cleanup = () => {
    unsubscribeLocation();
    unsubscribeTrigger();
    if (triggerTimer) clearTimeout(triggerTimer);
  };

  const returnToShell = () => {
    createShell(root, {
      modules,
      location,
      events,
      store,
      settings,
      install,
      revealFromLogo: true
    });
  };

  const navigate = async callback => {
    homeBrand?.classList.add('is-to-logo');
    await sleep(NAV_MS);
    cleanup();
    callback();
  };

  const openLocations = (locationId = '') => {
    openLocationsView(root, {
      store,
      location,
      events,
      initialLocationId: locationId,
      onBack: returnToShell
    });
  };

  root.querySelector('[data-settings]').addEventListener('click', () => {
    navigate(() => {
      openSettings(root, {
        settings,
        install,
        events,
        onBack: returnToShell
      });
    });
  });

  root.querySelector('[data-location-check]').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    setSearching();
    message.textContent = 'Locatie controleren…';

    try {
      const point = await location.checkNow({
        reason: 'manual',
        maxAgeMs: 0,
        highAccuracy: true
      });
      setReady();
      message.textContent =
        `Locatie beschikbaar · ±${Math.round(point.accuracy)} m`;
    } catch (error) {
      status.classList.remove('is-searching');
      message.textContent = error.message;
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  const existing = location.latest;
  if (existing) {
    setReady();
    message.textContent = `Locatie beschikbaar · ±${Math.round(existing.accuracy)} m`;
  } else if (initialModule) {
    const selected = modules.get(initialModule);
    if (selected) message.textContent = `Je start bij ${selected.title}.`;
  }

  root.querySelectorAll('[data-module]').forEach(button => {
    button.addEventListener('click', () => {
      const module = modules.get(button.dataset.module);
      if (!module) return;

      if (module.id === 'locations') {
        navigate(() => openLocations());
        return;
      }

      navigate(() => openPlaceholder(root, module.title, returnToShell));
    });
  });

  if (initialModule === 'locations' && initialLocationId) {
    queueMicrotask(() => {
      cleanup();
      openLocations(initialLocationId);
    });
  }
}

function openPlaceholder(root, title, onBack) {
  root.innerHTML = `
    <main class="detail-shell">
      ${detailHeader(title)}
      <section class="placeholder-copy">
        <p>${escapeHtml(title)} wordt hier verder opgebouwd.</p>
      </section>
    </main>
  `;

  root.querySelector('[data-home-logo]').addEventListener('click', onBack);
  bindSwipeHome(root.querySelector('.detail-shell'), onBack);
}

function detailHeader(title) {
  return `
    <header class="detail-header logo-detail-header">
      <button type="button" class="home-logo-button" data-home-logo aria-label="Terug naar beginscherm">
        ${sharonLogo({ className: 'detail-home-logo' })}
      </button>
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

function chevron() {
  return `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5"/>
    </svg>
  `;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}
