import { openLocationsView } from './LocationsView.js?v=0.1.65';
import { openEnvironmentView } from './EnvironmentMapLibre.js?v=0.1.65';
import { openSettings } from './SettingsView.js?v=0.1.65';
import { sharonWordmark } from './Brand.js?v=0.1.65';
import { bindSwipeHome } from './SwipeHome.js?v=0.1.65';

const APP_VERSION = '0.1.65';
const VIEW_FADE_MS = 110;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createShell(root, {
  modules,
  location,
  events,
  store,
  settings,
  install,
  initialModule = '',
  initialLocationId = ''
}) {
  const list = modules.list();
  let triggerTimer = null;
  let currentView = 'home';
  let viewChange = 0;
  let viewCleanup = null;

  document.body.classList.add('sharon-shell-active');

  root.innerHTML = `
    <div class="app-stage" data-app-stage>
    <main class="app-frame" data-app-frame>
      <header class="app-header" data-app-header>
        <button type="button" class="persistent-brand-button" data-brand-control aria-label="Sharon">
          ${sharonWordmark({
            mode: 'sharon',
            className: 'home-brand-vector persistent-brand-vector',
            dataHook: 'data-app-brand',
            label: 'Sharon'
          })}
        </button>

        <h1 class="app-view-title" data-view-title></h1>

        <span
          class="location-pulse is-searching"
          data-location-status
          title="Locatie wordt bepaald"
          aria-label="Locatie wordt bepaald"
        ></span>
      </header>

      <div class="trigger-toast persistent-toast" data-trigger-toast hidden></div>

      <section class="app-view" data-view-outlet></section>
    </main>
    </div>
  `;

  const stage = root.querySelector('[data-app-stage]');
  const frame = root.querySelector('[data-app-frame]');
  const header = root.querySelector('[data-app-header]');
  const brandButton = root.querySelector('[data-brand-control]');
  const brand = root.querySelector('[data-app-brand]');
  const title = root.querySelector('[data-view-title]');
  const status = root.querySelector('[data-location-status]');
  const toast = root.querySelector('[data-trigger-toast]');
  const outlet = root.querySelector('[data-view-outlet]');

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

  events.on('location.changed', event => {
    setReady();
    const accuracy = Math.round(event.detail?.accuracy ?? 0);
    const message = outlet.querySelector('[data-message]');
    if (!message) return;
    message.textContent = accuracy
      ? `Locatie beschikbaar · ±${accuracy} m`
      : 'Locatie beschikbaar';
  });

  events.on('trigger.fired', event => {
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

  const setDetailTitle = value => {
    title.textContent = value || '';
  };

  const swapView = async (renderer, { animate = true } = {}) => {
    const change = ++viewChange;

    if (animate) {
      outlet.classList.add('is-changing');
      await sleep(VIEW_FADE_MS);
      if (change !== viewChange) return;
    }

    if (viewCleanup) {
      viewCleanup();
      viewCleanup = null;
    }

    const cleanup = await renderer();
    if (change !== viewChange) {
      if (typeof cleanup === 'function') cleanup();
      return;
    }
    if (typeof cleanup === 'function') viewCleanup = cleanup;

    if (animate) {
      requestAnimationFrame(() => outlet.classList.remove('is-changing'));
    } else {
      outlet.classList.remove('is-changing');
    }
  };

  const setHeaderMode = (mode, viewTitle = '', moduleId = '') => {
    const detail = mode === 'detail';
    const environment = detail && moduleId === 'environment';
    currentView = detail ? 'detail' : 'home';

    stage.dataset.view = currentView;
    frame.dataset.view = currentView;
    stage.classList.toggle('is-environment', environment);
    frame.classList.toggle('is-environment', environment);
    header.classList.toggle('is-detail', detail);
    brand.classList.toggle('is-detail', detail);
    brandButton.setAttribute(
      'aria-label',
      detail ? 'Terug naar beginscherm' : 'Sharon'
    );
    setDetailTitle(detail ? viewTitle : '');
  };

  const renderHome = () => {
    outlet.innerHTML = `
      <div class="home-view">
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
          <span class="shell-footer-meta">
            <button type="button" class="quiet-action" data-location-check>Ververs locatie</button>
            <small class="app-version">v${APP_VERSION}</small>
          </span>
        </footer>
      </div>
    `;

    const message = outlet.querySelector('[data-message]');
    const existing = location.latest;

    if (existing) {
      setReady();
      message.textContent = `Locatie beschikbaar · ±${Math.round(existing.accuracy)} m`;
    }

    outlet.querySelector('[data-location-check]').addEventListener('click', async event => {
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

    outlet.querySelector('[data-settings]').addEventListener('click', () => {
      openSettingsView();
    });

    outlet.querySelectorAll('[data-module]').forEach(button => {
      button.addEventListener('click', () => {
        openModule(button.dataset.module);
      });
    });
  };

  const showHome = async ({ animate = true } = {}) => {
    if (currentView === 'home') return;
    setHeaderMode('home');
    await swapView(() => renderHome(), { animate });
  };

  const openPlaceholder = async module => {
    setHeaderMode('detail', module.title, module.id);
    await swapView(() => {
      outlet.innerHTML = `
        <section class="module-view placeholder-copy">
          <p>${escapeHtml(module.title)} wordt hier verder opgebouwd.</p>
        </section>
      `;
    });
  };

  const openLocations = async (locationId = '', { animate = true } = {}) => {
    setHeaderMode('detail', locationId ? 'Locatie' : 'Locaties', 'locations');
    await swapView(() => openLocationsView(outlet, {
      store,
      location,
      events,
      initialLocationId: locationId,
      setTitle: setDetailTitle
    }), { animate });
  };

  const openEnvironment = async ({ animate = true } = {}) => {
    setHeaderMode('detail', 'Omgeving', 'environment');
    await swapView(() => openEnvironmentView(outlet, {
      store,
      location,
      events,
      setTitle: setDetailTitle
    }), { animate });
  };

  const openSettingsView = async ({ animate = true } = {}) => {
    setHeaderMode('detail', 'Instellingen', 'settings');
    await swapView(() => openSettings(outlet, {
      settings,
      install,
      events,
      store
    }), { animate });
  };

  const openModule = async (moduleId, options = {}) => {
    const module = modules.get(moduleId);
    if (!module) return;

    if (module.id === 'locations') {
      await openLocations(options.locationId || '', {
        animate: options.animate !== false
      });
      return;
    }

    if (module.id === 'environment') {
      await openEnvironment({
        animate: options.animate !== false
      });
      return;
    }

    await openPlaceholder(module);
  };

  brandButton.addEventListener('click', () => {
    if (currentView === 'detail') showHome();
  });

  bindSwipeHome(stage, () => {
    if (currentView === 'detail') return showHome();
  }, {
    isEnabled: () => currentView === 'detail'
  });

  setHeaderMode('home');
  renderHome();

  if (initialModule === 'locations' && initialLocationId) {
    queueMicrotask(() => {
      openLocations(initialLocationId, { animate: false });
    });
  }
}

function chevron() {
  return `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5"/>
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}
