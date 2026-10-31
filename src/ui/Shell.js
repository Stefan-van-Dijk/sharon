import { isTransferScan, receiveTransfer } from './ObjectTransfer.js?v=0.4.46';
import { ChatMonitor } from '../core/connection/ChatMonitor.js?v=0.4.46';
import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.46';
import { mountCardArrival } from './CardArrival.js?v=0.4.46';
import { createDemoWorkspaceStore } from '../core/skeleton/DemoWorkspaceStore.js?v=0.4.46';
import { mountHomeCardContext } from './HomeCardContext.js?v=0.4.46';
import { syncViewportHeight } from './Viewport.js?v=0.4.46';
import { demoWorkspace, SKELETON_MODULES } from '../core/skeleton/SkeletonCore.js?v=0.4.46';
import { mountSkeletonDemo } from './SkeletonDemoView.js?v=0.4.46';
import { openPeopleView } from './PeopleView.js?v=0.4.46';
import { openCardsView } from './CardsView.js?v=0.4.46';
import { openLocationsView } from './LocationsView.js?v=0.4.46';
import { openEnvironmentView } from './EnvironmentMapLibre.js?v=0.4.46';
import { openSettings } from './SettingsView.js?v=0.4.46';
import { sharonWordmark } from './Brand.js?v=0.4.46';
import { bindSwipeHome } from './SwipeHome.js?v=0.4.46';

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
  codes: ['Scan en beheer QR-codes en barcodes als verwijzingen.', 'Verbindt met Kaarten, Objecten, Personen en Acties.'],
  settings: ['Stel Sharon, privacy en gegevensbeheer naar wens in.', 'Deze keuzes gelden voor alle modules.']
});
const MENU_ORDER = ['environment','locations','cards','persons','objects','themes','actions','notes','agenda','time','rides','codes'];
const MENU_TITLES = Object.freeze({environment:'Omgeving',locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',themes:"Thema's",actions:'Acties',notes:'Notities',agenda:'Agenda',time:'Tijd',rides:'Ritten',codes:'Codes'});
const MENU_PREVIEW_ONLY = new Set(['notes','agenda']);
const MENU_TEST_ID = Object.freeze({persons:'persons',time:'tasks'});

const APP_VERSION = '0.4.46';
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
  workspace = null,
  initialModule = '',
  initialLocationId = ''
}) {
  const list = modules.list();
  let triggerTimer = null;
  let currentView = 'home';
  let viewChange = 0;
  let viewCleanup = null;
  const chatMonitor=new ChatMonitor(new ConnectionService(store));
  let chatState={total:0,error:''};
  const updatePeopleNotice=()=>{
    const dot=root.querySelector('[data-people-unread]');
    if(dot){dot.hidden=!chatState.total;dot.setAttribute('aria-label',chatState.total+' ongelezen berichten');}
    const error=root.querySelector('[data-people-connection-error]');if(error)error.hidden=!chatState.error;
  };
  chatMonitor.subscribe(state=>{chatState=state;updatePeopleNotice();});
  let networkMember = false;
  let demoMode = workspace?.testMode || false;
  const testWorkspaceStore = workspace?.testMode ? workspace.store : createDemoWorkspaceStore(store);
  const activeStore = () => workspace?.store || (demoMode ? testWorkspaceStore : store);
  const updateMessage = 'Update gereed. Sluit alle Sharon-vensters en open de app opnieuw.';
  events.on('app.update.ready', () => {
    const notice = root.querySelector('[data-update-notice]');
    if (notice) { notice.hidden = false; notice.textContent = updateMessage; }
  });

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
  // Status belongs to the brand area, not the far right of the header.
  brandButton.after(status);
  const headerActions = root.querySelector('[data-header-actions]');
  const toast = root.querySelector('[data-trigger-toast]');
  const outlet = root.querySelector('[data-view-outlet]');

  // Header geometry belongs to CSS; only the outlet scrolls on Home and in modules.
  status.style.position = 'relative';
  status.style.inset = 'auto';
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
      requestAnimationFrame(() => { outlet.classList.remove('is-changing'); events.emit('cards.context.check'); });
    } else {
      outlet.classList.remove('is-changing');
      events.emit('cards.context.check');
    }
  };

  // iOS standalone PWA may report 100dvh/100% shorter than its visible viewport.
  // Measure the actual viewport and keep the map stage and its canvas in sync.
  let viewportFrame = 0;
  const syncEnvironmentViewport = () => {
    if (!stage.classList.contains('is-environment')) return;
    syncViewportHeight();
    stage.style.setProperty('--environment-viewport-height', document.documentElement.style.getPropertyValue('--sharon-viewport-height'));
    if (viewportFrame) cancelAnimationFrame(viewportFrame);
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
        <section class="sh-home-context" data-home-context aria-label="Passend bij deze plek" aria-live="polite" hidden></section>
        <nav class="module-list" aria-label="Onderdelen">
          ${MENU_ORDER.filter(id => id !== 'persons' || demoMode || networkMember).map(id => {
            const moduleId = demoMode ? (MENU_TEST_ID[id] || id) : (id === 'persons' ? 'people' : id);
            const previewOnly = MENU_PREVIEW_ONLY.has(id) || (demoMode && !SKELETON_MODULES.includes(moduleId) && !['environment','locations','cards'].includes(moduleId));
            const title = MENU_TITLES[id];
            return `
              <div class="sh-home-module-item" data-guide-item>
                <div class="sh-home-module-line">
                  <span class="sh-home-swipe-reveal" aria-hidden="true">i</span>
                  <button type="button" class="module-row" data-module="${moduleId}" data-preview-title="${title}" data-guide-id="${id}" ${previewOnly ? 'data-preview-only="true"' : ''}>
                    <span>${title}</span>${id==='persons'&&!demoMode?'<span class="sh-notification-dot" data-people-unread role="img" aria-label="Ongelezen berichten" hidden></span><small data-people-connection-error hidden>Geen verbinding</small>':''}</button>
                  
                </div>
                <div class="sh-home-module-guide" data-guide-panel hidden aria-live="polite"></div>
              </div>`;
          }).join('')}

          <div class="sh-home-module-item" data-guide-item>
            <div class="sh-home-module-line">
              <span class="sh-home-swipe-reveal" aria-hidden="true">i</span>
              <button type="button" class="module-row settings-home-row" data-settings>
                <span>Instellingen</span>
              </button>
              
            </div>
            <div class="sh-home-module-guide" data-guide-panel hidden aria-live="polite"></div>
          </div>
        </nav>

        ${demoMode ? '<p class="sh-skeleton-home-label">Testomgeving · fictieve gegevens</p>' : ''}
        <footer class="shell-footer">
          <span data-update-notice role="status" ${install.getState().updateReady ? '' : 'hidden'}>${install.getState().updateReady ? updateMessage : ''}</span>
          <span class="location-state" data-message>Locatie wordt bij openen gecontroleerd.</span>
          <span class="shell-footer-meta">
            <button type="button" class="quiet-action" data-location-check>Ververs locatie</button>
            <small class="app-version">v${APP_VERSION}</small>
          </span>
        </footer>
      </div>
    `;

    headerActions.innerHTML = '<button type="button" class="sh-home-board-stack" data-home-board-stack disabled aria-label="Geen relevante boards" title="Relevante boards"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="3"/><path d="M7 3h10a3 3 0 0 1 3 3v11"/></svg></button>';
    const cleanupContext = mountHomeCardContext(outlet.querySelector('[data-home-context]'), {store: activeStore(), location, events, trigger: headerActions.querySelector('[data-home-board-stack]')});
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

    updatePeopleNotice();
    outlet.querySelector('[data-settings]').addEventListener('click', () => {
      openSettingsView();
    });

    let guideInterval = null;
    const closeGuide = () => {
      clearInterval(guideInterval);
      guideInterval = null;
      outlet.querySelectorAll('[data-guide-item]').forEach(item => {
        item.querySelector('[data-guide-panel]').hidden = true;
      });
    };
    const toggleGuide = item => {
      const panel = item.querySelector('[data-guide-panel]');
      const isOpen = !panel.hidden;
      closeGuide();
      if (isOpen) return;
      const id = item.querySelector('[data-module-guide]')?.dataset.moduleGuide
        || item.querySelector('[data-module]')?.dataset.guideId
        || (item.querySelector('[data-settings]') ? 'settings' : '');
      const [purpose, links] = MODULE_GUIDE[id] || [];
      if (!purpose) return;
      panel.hidden = false;
      const copy = [purpose, links].filter(Boolean).join('\\n');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        panel.textContent = copy;
        return;
      }
      let position = 0;
      guideInterval = setInterval(() => {
        if (!panel.isConnected || panel.hidden) { clearInterval(guideInterval); return; }
        position = Math.min(copy.length, position + 2);
        panel.textContent = copy.slice(0, position);
        if (position >= copy.length) { clearInterval(guideInterval); guideInterval = null; }
      }, 17);
    };
    outlet.querySelectorAll('[data-guide-item]').forEach(item => {
      const line = item.querySelector('.sh-home-module-line');
      const row = line?.querySelector('.module-row');
      const reveal = line?.querySelector('.sh-home-swipe-reveal');
      let start = null;
      let tracking = false;
      const reset = () => {
        start = null;
        tracking = false;
        line.classList.remove('is-dragging');
        row.style.removeProperty('transform');
        reveal.style.removeProperty('opacity');
      };
      item.addEventListener('touchstart', event => {
        if (event.touches.length !== 1) return;
        start = {x:event.touches[0].clientX, y:event.touches[0].clientY};
        tracking = false;
      }, {passive:true});
      item.addEventListener('touchmove', event => {
        if (!start || event.touches.length !== 1) return;
        const dx = event.touches[0].clientX - start.x;
        const dy = event.touches[0].clientY - start.y;
        if (!tracking && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
        if (!tracking && dx > 9) { reset(); return; }
        if (!tracking && dx < -9) tracking = true;
        if (!tracking) return;
        event.preventDefault();
        const distance = Math.min(72, Math.max(0, -dx));
        line.classList.add('is-dragging');
        row.style.transform = 'translateX(' + (-distance) + 'px)';
        reveal.style.opacity = String(Math.min(1,distance/40));
      }, {passive:false});
      item.addEventListener('touchend', event => {
        if (!start || event.changedTouches.length !== 1) { reset(); return; }
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        const activate = tracking && dx < -48 && Math.abs(dx) > Math.abs(dy)*1.3;
        if (tracking) {
          item.dataset.justSwiped = 'true';
          setTimeout(() => { delete item.dataset.justSwiped; }, 350);
          event.preventDefault();
        }
        reset();
        if (activate) toggleGuide(item);
      }, {passive:false});
      item.addEventListener('touchcancel',reset);
      item.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          toggleGuide(item);
        }
      });
    });
    outlet.querySelectorAll('[data-module]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.closest('[data-guide-item]')?.dataset.justSwiped) return;
        closeGuide();
        if (button.dataset.previewOnly === 'true') {
          openPlaceholder({id:button.dataset.module, title:button.dataset.previewTitle});
        } else {
          openModule(button.dataset.module);
        }
      });
    });
    return () => { cleanupContext(); closeGuide(); };
  };

  const showHome = async ({ animate = true } = {}) => {
    if (currentView === 'home') return;
    setHeaderMode('home');
    await swapView(() => renderHome(), { animate });
  };

  const openPlaceholder = async module => {
    setHeaderMode('detail', module.title, module.id);
    await swapView(() => {
      const item = Object.entries(MENU_TITLES).find(([, title]) => title === module.title);
      const [purpose, links] = MODULE_GUIDE[item?.[0]] || ['Leg informatie vast en verbind deze later met andere onderdelen.',''];
      outlet.innerHTML = `
        <section class="module-view placeholder-copy">
          <button type="button" class="sh-module-example" data-module-example><span>Voorbeeld · ${escapeHtml(module.title)}</span><small>Veeg of tik om te ontdekken wat je hier kunt vastleggen</small></button>
          <p class="sh-module-example-guide" data-example-copy hidden></p>
        </section>
      `;
      const example = outlet.querySelector('[data-module-example]');
      const copy = outlet.querySelector('[data-example-copy]');
      const reveal = () => { copy.hidden = !copy.hidden; copy.textContent = [purpose,links].filter(Boolean).join('\\n'); };
      example.addEventListener('click',reveal);
      let touch = null;
      example.addEventListener('touchstart',e=>{touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
      example.addEventListener('touchend',e=>{if(!touch)return; const dx=e.changedTouches[0].clientX-touch.x; const dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){e.preventDefault();reveal();}},{passive:false});
    });
    if (module.id !== 'environment') {
      headerActions.innerHTML = '<button type="button" class="sh-module-add" aria-label="Toevoegen" title="Toevoegen">+</button>';
      headerActions.querySelector('button').addEventListener('click',()=>{
        const copy=outlet.querySelector('[data-example-copy]');
        if(copy){copy.hidden=false;copy.textContent='Deze module is in voorbereiding. Je kunt straks direct iets vastleggen en later relaties toevoegen.';}
      });
    }
  };

  const openLocations = async (locationId = '', { animate = true } = {}) => {
    setHeaderMode('detail', locationId ? 'Locatie' : 'Locaties', 'locations');
    await swapView(() => openLocationsView(outlet, {
      store: activeStore(),
      location,
      geocoder,
      events,
      initialLocationId: locationId,
      setTitle: setDetailTitle,
      headerActions
    }), { animate });
  };

  const openEnvironment = async ({ animate = true, chainId = '' } = {}) => {
    setHeaderMode('detail', 'Omgeving', 'environment');
    await swapView(() => openEnvironmentView(outlet, {
      initialChainId:chainId,
      store: activeStore(),
      location,
      events,
      setTitle: setDetailTitle,
      headerActions
    }), { animate });
  };

  const openCards = async ({ animate = true, scanned = null, cardId = null } = {}) => {
    if(scanned&&await isTransferScan(activeStore(),scanned)){const saved=await receiveTransfer(activeStore(),scanned.value);events.emit(saved.type==='card'?'cards.changed':'location.created',{id:saved.id});if(saved.type==='location')return openLocations(saved.id);cardId=saved.id;scanned=null;}
    setHeaderMode('detail', 'Kaarten', 'cards');
    await swapView(() => openCardsView(outlet, {
      store: activeStore(),
      location,
      events,
      setTitle: setDetailTitle,
      headerActions,
      initialScan: scanned,
      initialCardId: cardId,
      onConnection: () => openModule('people',{scanned:true})
    }), { animate });
  };

  events.on('environment.chain.open',event=>openModule('environment',{chainId:event.detail.chainId}));

  const openSettingsView = async ({ animate = true } = {}) => {
    setHeaderMode('detail', 'Instellingen', 'settings');
    await swapView(() => openSettings(outlet, {
      settings,
      install,
      events,
      store,
      resetNetwork:()=>chatMonitor.resetNetwork(),
      onNetworkReset:()=>{networkMember=false;},
      onNetworkStart:()=>openModule('people',{activate:true})
    }), { animate });
  };

  const openModule = async (moduleId, options = {}) => {
    if (demoMode && SKELETON_MODULES.includes(moduleId) && !['locations', 'cards', 'environment'].includes(moduleId)) {
      const name=({locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',rides:'Ritten',tasks:'Tijd/Taken',actions:'Acties'})[moduleId];
      setHeaderMode('detail',name,moduleId);
      await swapView(() => mountSkeletonDemo(outlet,store,{initialModule:moduleId,fullScreen:true,onTitleChange:setDetailTitle}),{animate:options.animate!==false});
      headerActions.innerHTML = '<button type="button" class="sh-module-add" aria-label="Toevoegen" title="Toevoegen">+</button>';
      headerActions.querySelector('button').addEventListener('click', () => {
        outlet.querySelector('[data-demo-add]')?.click();
      });
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
        chainId:options.chainId||'',
        animate: options.animate !== false
      });
      return;
    }

    if (['people','codes'].includes(module.id) && !demoMode) {
      setHeaderMode('detail', 'Personen', 'people');
      await swapView(() => openPeopleView(outlet, {store, settings, location, chatMonitor, headerActions, onOpenObject: item=>item.type==='card'?openCards({cardId:item.id}):openLocations(item.id), setTitle: setDetailTitle, initialScreen: options.activate?'owner-start':options.scanned?'scanned':options.camera?'camera':module.id==='codes'?'scan':'', onCode: result=>openCards({scanned:result}), onMembership: value => { networkMember=value; }}), {animate: options.animate !== false});
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
    const cardBoard = document.querySelector('.sh-card-board-overlay');
    if (cardBoard) { cardBoard.dispatchEvent(new Event('sharon:close-board')); return true; }
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

  bindSwipeHome(stage, () => {
    if(currentView==='home') { openHistoryModule('codes');return openModule('codes',{camera:true}); }
    return navigateBack();
  }, {
    isEnabled: () => currentView === 'detail' || !demoMode,
    edgeOnly: () => currentView !== 'home',
    allowHomeRows: () => currentView === 'home'
  });

  setHeaderMode('home');
  Promise.all([demoWorkspace(store),store.get('meta','connection.device.log-json.v1')]).then(([{enabled},device]) => {
    networkMember=device?.value?.registered===true && Number.isInteger(device?.value?.self?.line);
    demoMode=enabled;
    if(!demoMode)chatMonitor.start();
    if (currentView === 'home') { viewCleanup?.(); viewCleanup = renderHome(); }
    mountCardArrival({
      store: activeStore(), location, events,
      canOpen: () => currentView === 'home' && !outlet.classList.contains('is-changing') &&
        !outlet.querySelector('form') && !document.querySelector('[role="dialog"], .story-layer')
    });
  }).catch(error => { console.warn('Skelet testomgeving kon niet laden',error);viewCleanup = renderHome(); });

  if (initialModule === 'people' && !demoMode) {
    queueMicrotask(() => openModule('people', {animate: false}));
  }

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
