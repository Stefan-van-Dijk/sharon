import { demoWorkspace, SKELETON_MODULES } from '../core/skeleton/SkeletonCore.js?v=0.3.49';
import { mountSkeletonDemo } from './SkeletonDemoView.js?v=0.3.49';
import { openCardsView } from './CardsView.js?v=0.3.49';
import { openLocationsView } from './LocationsView.js?v=0.2.86';
import { openEnvironmentView } from './EnvironmentMapLibre.js?v=0.3.49';
import { openSettings } from './SettingsView.js?v=0.3.49';
import { sharonWordmark } from './Brand.js?v=0.1.90';
import { bindSwipeHome } from './SwipeHome.js?v=0.2.86';

const MODULE_GUIDE = Object.freeze({
  environment: ['Bekijk wat er om je heen gebeurt en welke informatie relevant is.', 'Verbindt met Locaties, Kaarten, Objecten en Thema\'s.'],
  locations: ['Leg plekken vast, herken ze bij aankomst en voeg sublocaties toe.', 'Verbindt met Ritten, Acties, Agenda, Personen en Objecten.'],
  cards: ['Bewaar passen en gebruik ze op de juiste plek.', 'Verbindt met Locaties, Codes, Personen en relevante organisaties.'],
  persons: ['Bewaar contacten en zie wat je met iemand hebt afgesproken.', 'Verbindt met Acties, Agenda, Notities en gedeelde boards.'],
  objects: ['Leg voorwerpen vast en bekijk hun informatie en geschiedenis.', 'Verbindt met Locaties, Codes, Acties en Notities.'],
  themes: ['Breng onderwerpen en interesses bij elkaar.', 'Verbindt met Acties, Notities, Agenda en externe boards.'],
  actions: ['Leg direct vast wat je wilt doen, ook zonder planning of koppeling.', 'Verbindt later met Personen, Thema\'s, Agenda, Tijd en Locaties.'],
  notes: ['Bewaar een gedachte of informatie zonder vooraf een structuur te kiezen.', 'Verbindt later met Acties, Personen, Objecten en Thema\'s.'],
  agenda: ['Plan afspraken en gebeurtenissen, alleen of met anderen.', 'Verbindt met Personen, Locaties, Acties en Tijd.'],
  time: ['Leg vast waaraan je tijd besteedt.', 'Verbindt met Acties, Agenda, Ritten en Thema\'s.'],
  rides: ['Registreer verplaatsingen tussen plekken.', 'Verbindt met Locaties, Tijd, Acties en Agenda.'],
  codes: ['Scan en beheer QR-codes en barcodes als verwijzingen.', 'Verbindt met Kaarten, Objecten, Personen en Acties.']
});
const MENU_ORDER = ['environment','locations','cards','persons','objects','themes','actions','notes','agenda','time','rides','codes'];
const MENU_TITLES = Object.freeze({environment:'Omgeving',locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',themes:"Thema's",actions:'Acties',notes:'Notities',agenda:'Agenda',time:'Tijd',rides:'Ritten',codes:'Codes'});
const MENU_PREVIEW_ONLY = new Set(['notes','agenda']);
const MENU_TEST_ID = Object.freeze({persons:'persons',time:'tasks'});

const APP_VERSION = '0.3.49';
const VIEW_FADE_MS = 110;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createShell(root, {
  modules,
  geocoder,
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
  let demoMode = false;

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
        <div class="app-header-actions" data-header-actions></div>

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
  const headerActions = root.querySelector('[data-header-actions]');
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

  // iOS standalone PWA may report 100dvh/100% shorter than its visible viewport.
  // Measure the actual viewport and keep the map stage and its canvas in sync.
  let viewportFrame = 0;
  const syncEnvironmentViewport = () => {
    if (!stage.classList.contains('is-environment')) return;
    const vv = window.visualViewport;
    const measured = Math.max(window.innerHeight || 0, vv ? vv.height + vv.offsetTop : 0);
    if (measured > 0) stage.style.setProperty('--environment-viewport-height', measured + 'px');
    viewportFrame = requestAnimationFrame(() => {
      viewportFrame = 0;
      outlet.querySelector('[data-maplibre-map]')?.dispatchEvent(new Event('sharon:viewport-resize'));
    });
  };
  window.addEventListener('resize', syncEnvironmentViewport);
  window.addEventListener('orientationchange', syncEnvironmentViewport);
  window.visualViewport?.addEventListener('resize', syncEnvironmentViewport);
  window.visualViewport?.addEventListener('scroll', syncEnvironmentViewport);

  const setHeaderMode = (mode, viewTitle = '', moduleId = '') => {
    const detail = mode === 'detail';
    const environment = detail && moduleId === 'environment';
    currentView = detail ? 'detail' : 'home';
    // iOS must scroll the module outlet, never the page containing the header.
    document.body.classList.toggle('sharon-detail-active', detail);

    stage.dataset.view = currentView;
    stage.dataset.module = detail ? moduleId : '';
    frame.dataset.view = currentView;
    stage.classList.toggle('is-environment', environment);
    if (environment) requestAnimationFrame(syncEnvironmentViewport);
    else { stage.style.removeProperty('--environment-viewport-height'); if(viewportFrame)cancelAnimationFrame(viewportFrame); }
    frame.classList.toggle('is-environment', environment);
    if (!environment) headerActions.replaceChildren();
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
          ${MENU_ORDER.map(id => {
            const moduleId = demoMode ? (MENU_TEST_ID[id] || id) : (id === 'persons' ? 'people' : id);
            const previewOnly = MENU_PREVIEW_ONLY.has(id) || (demoMode && !SKELETON_MODULES.includes(moduleId) && !['environment','locations','cards'].includes(moduleId));
            const title = MENU_TITLES[id];
            return `
              <div class="sh-home-module-item" data-guide-item>
                <div class="sh-home-module-line">
                  <button type="button" class="module-row" data-module="${moduleId}" data-preview-title="${title}" ${previewOnly ? 'data-preview-only="true"' : ''}>
                    <span>${title}</span>${chevron()}
                  </button>
                  <button type="button" class="sh-home-module-info" data-module-guide="${id}" aria-label="Uitleg over ${title}" aria-expanded="false">i</button>
                </div>
                <div class="sh-home-module-guide" data-guide-panel hidden aria-live="polite"></div>
              </div>`;
          }).join('')}

          <button class="module-row settings-home-row" data-settings>
            <span>Instellingen</span>
            ${chevron()}
          </button>
        </nav>

        ${demoMode ? '<p class="sh-skeleton-home-label">Testomgeving · fictieve gegevens</p>' : ''}
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

    let guideInterval = null;
    const closeGuide = () => {
      if (guideInterval) clearInterval(guideInterval);
      guideInterval = null;
      outlet.querySelectorAll('[data-guide-item]').forEach(item => {
        item.querySelector('[data-guide-panel]').hidden = true;
        item.querySelector('[data-module-guide]').setAttribute('aria-expanded', 'false');
      });
    };
    outlet.querySelectorAll('[data-module-guide]').forEach(info => {
      info.addEventListener('click', () => {
        const item = info.closest('[data-guide-item]');
        const panel = item.querySelector('[data-guide-panel]');
        const wasOpen = !panel.hidden;
        closeGuide();
        if (wasOpen) return;
        panel.hidden = false;
        info.setAttribute('aria-expanded', 'true');
        const [purpose, links] = MODULE_GUIDE[info.dataset.moduleGuide] || [];
        const copy = [purpose, links].filter(Boolean).join('\n');
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          panel.textContent = copy;
          return;
        }
        let position = 0;
        guideInterval = setInterval(() => {
          if (!panel.isConnected || panel.hidden) { clearInterval(guideInterval); guideInterval = null; return; }
          position = Math.min(copy.length, position + 2);
          panel.textContent = copy.slice(0, position);
          if (position >= copy.length) { clearInterval(guideInterval); guideInterval = null; }
        }, 17);
      });
    });
    outlet.querySelectorAll('[data-module]').forEach(button => {
      button.addEventListener('click', () => {
        closeGuide();
        if (button.dataset.previewOnly === 'true') {
          openPlaceholder({id:button.dataset.module, title:button.dataset.previewTitle});
        } else {
          openModule(button.dataset.module);
        }
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
      geocoder,
      events,
      initialLocationId: locationId,
      setTitle: setDetailTitle,
      headerActions
    }), { animate });
  };

  const openEnvironment = async ({ animate = true } = {}) => {
    setHeaderMode('detail', 'Omgeving', 'environment');
    await swapView(() => openEnvironmentView(outlet, {
      store,
      location,
      events,
      setTitle: setDetailTitle,
      headerActions
    }), { animate });
  };

  const openCards = async ({ animate = true } = {}) => {
    setHeaderMode('detail', 'Kaarten', 'cards');
    await swapView(() => openCardsView(outlet, {
      store,
      setTitle: setDetailTitle,
      headerActions
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

  // Public map renderer is shared; private object data and camera preferences are not.
  const testEnvironmentStore = {
    getAll: async table => table === 'objects' ? [] : [],
    get: async (table,key) => table === 'meta'
      ? store.get('meta','skeleton.environment.' + key) : null,
    put: async (table,value) => {
      if(table !== 'meta' || !value?.key) throw new Error('Testkaart schrijft niet naar live objecten.');
      return store.put('meta',{...value,key:'skeleton.environment.' + value.key});
    },
    delete: async () => { throw new Error('Verwijderen is in de testkaart niet beschikbaar.'); }
  };

  const openModule = async (moduleId, options = {}) => {
    if (demoMode && moduleId === 'environment') {
      setHeaderMode('detail','Omgeving','environment');
      await swapView(() => openEnvironmentView(outlet,{
        store:testEnvironmentStore,location,events,setTitle:setDetailTitle,headerActions
      }),{animate:options.animate!==false});
      return;
    }
    if (demoMode && SKELETON_MODULES.includes(moduleId)) {
      const name=({locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',rides:'Ritten',tasks:'Tijd/Taken',actions:'Acties'})[moduleId];
      setHeaderMode('detail',name,moduleId);
      await swapView(() => mountSkeletonDemo(outlet,store,{initialModule:moduleId,fullScreen:true,onTitleChange:setDetailTitle}),{animate:options.animate!==false});
      return;
    }
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

    if (module.id === 'cards') {
      await openCards({ animate: options.animate !== false });
      return;
    }

    await openPlaceholder(module);
  };

  // Android's system Back button and predictive-back gesture trigger history navigation.
  // Keep one history entry for the shell and one for each opened module.
  const navigationKey = '__sharonNavigation';
  const homeState = () => ({ ...history.state, [navigationKey]: 'home' });
  if (!history.state?.[navigationKey]) history.replaceState(homeState(), '');
  const openHistoryModule = moduleId => {
    if (history.state?.[navigationKey] !== moduleId) {
      history.pushState({ ...history.state, [navigationKey]: moduleId }, '');
    }
  };
  const navigateBack = () => {
    if (currentView !== 'detail') return false;
    // Let the active skeleton screen consume one internal navigation level.
    if (demoMode && outlet.querySelector('.sh-skeleton-screen')) {
      const request=new Event('sharon:navigate-back',{cancelable:true});
      outlet.querySelector('.sh-skeleton-screen').dispatchEvent(request);
      if(request.defaultPrevented)return true;
    }
    // The editor owns its guided steps. Never discard a form by returning Home.
    const editor = outlet.querySelector('.location-editor-view[data-stage]');
    const cardEditor = outlet.querySelector('.sh-card-form');
    if (cardEditor) {
      const request = new Event('sharon:navigate-back', { cancelable: true });
      cardEditor.dispatchEvent(request);
      if (request.defaultPrevented) return true;
    }
    if (editor) {
      const request = new Event('sharon:navigate-back', { cancelable: true });
      editor.dispatchEvent(request);
      if (request.defaultPrevented) return true;
    }
    // Only use the active screen's own back control; no hidden or nested buttons.
    const screen = outlet.querySelector('.app-view > .module-view, :scope > .module-view');
    const back = screen?.querySelector('.sh-location-editor-nav > [data-back], [data-navigation-back]');
    if (back && !back.hidden && !back.disabled) {
      back.click();
      return true;
    }
    // Module roots have no previous internal screen.
    showHome();
    return false;
  };
  window.addEventListener('popstate', event => {
    const target = event.state?.[navigationKey];
    if (!target || target === 'home') {
      if (currentView === 'detail') {
        const handledInternally = navigateBack();
        // Keep Android/system Back consistent: internal screens must not consume
        // the module history entry and make the next Back leave Sharon.
        if (handledInternally) {
          const activeModule = stage.dataset.module || 'locations';
          history.pushState({ ...history.state, [navigationKey]: activeModule }, '');
        }
      }
      return;
    }
    if (target === 'settings') openSettingsView({ animate: false });
    else openModule(target, { animate: false });
  });
  outlet.addEventListener('click', event => {
    const moduleButton = event.target.closest('[data-module]');
    if (moduleButton && currentView === 'home') {
      // Module clicks already have handlers; only register their history entry.
      openHistoryModule(moduleButton.dataset.module);
    }
    if (event.target.closest('[data-settings]') && currentView === 'home') openHistoryModule('settings');
  }, true);

  brandButton.addEventListener('click', () => {
    if (currentView === 'detail') showHome();
  });

  bindSwipeHome(stage, () => navigateBack(), {
    isEnabled: () => currentView === 'detail'
  });

  setHeaderMode('home');
  demoWorkspace(store).then(({enabled}) => {
    demoMode=enabled;
    if (currentView === 'home') renderHome();
  }).catch(error => { console.warn('Skelet testomgeving kon niet laden',error);renderHome(); });

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
