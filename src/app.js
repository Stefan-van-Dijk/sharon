import {openShopCatalog} from './ui/ShopCatalog.js?v=0.5.29';
import { ChainSyncService } from './core/chains/ChainSyncService.js?v=0.5.29';
import { InformationFeedbackService } from './core/information/InformationFeedbackService.js?v=0.5.29';
import { captureConnectionLink, ConnectionService } from './core/connection/ConnectionService.js?v=0.5.29';
import { demoWorkspace } from './core/skeleton/SkeletonCore.js?v=0.5.29';
import { createDemoWorkspaceStore } from './core/skeleton/DemoWorkspaceStore.js?v=0.5.29';
import { IdentifierService } from './core/ids/IdentifierService.js?v=0.5.29';
import { EventBus } from './core/events/EventBus.js?v=0.5.29';
import { ObjectStore } from './core/storage/ObjectStore.js?v=0.5.29';
import { SettingsService } from './core/settings/SettingsService.js?v=0.5.29';
import { LocationService } from './core/location/LocationService.js?v=0.5.29';
import { ReverseGeocodeService } from './core/location/ReverseGeocodeService.js?v=0.5.29';
import { LocationTriggerService } from './core/location/LocationTriggerService.js?v=0.5.29';
import { InstallService } from './core/app/InstallService.js?v=0.5.29';
import { ModuleRegistry } from './modules/ModuleRegistry.js?v=0.5.29';
import { createShell } from './ui/Shell.js?v=0.5.29';
import { runFirstIntro, runReturningIntro } from './ui/Boot.js?v=0.5.29';
import { runStory } from './ui/Story.js?v=0.5.29';

export async function createApp({ testWorkspace = false } = {}) {
  const events = new EventBus();
  const store = new ObjectStore();
  const settings = new SettingsService(store, events);

  await store.open();
  const savedSettings = await store.get('settings', 'app');
  await settings.load();
  // Only an installation without saved settings receives the compact Home.
  // A forced intro and existing profiles retain their current module choices.
  if (!savedSettings) await settings.update({ home: { modules: ['environment', 'locations'] } });
  // Preserve a received code through onboarding, but never redeem it automatically.
  let connectionNotice = '';
  try { await captureConnectionLink(store); }
  catch (error) { connectionNotice = error.message; }

  const workspaceState = testWorkspace ? await demoWorkspace(store) : { enabled: false };
  const workspace = { testMode: workspaceState.enabled, store: workspaceState.enabled ? createDemoWorkspaceStore(store) : store };

  const location = new LocationService({ events, settings });
  const initialSettings = settings.get();
  const geocoder = new ReverseGeocodeService({
    endpoint: initialSettings.services?.reverseGeocode?.endpoint
  });
  const locationTriggers = new LocationTriggerService({ store: workspace.store, events });
  locationTriggers.start();
  const install = new InstallService({ events });

  const savedName = String(initialSettings.profile?.name || '').trim();
  const params = new URLSearchParams(window.location.search);
  const introMode = params.get('intro');
  const forceFirstIntro = introMode === '1';
  const forceKnownIntro = introMode === 'known';
  const forceStory = params.get('story') === '1';
  const firstRun = forceFirstIntro || (!savedName && !forceKnownIntro);

  let startupLocation = null;

  if (!firstRun) {
    startupLocation = location.checkNow({
      reason: 'startup',
      maxAgeMs: 60_000,
      highAccuracy: false,
      browserMaxAgeMs: 60_000,
      timeoutMs: 4_000
    }).catch(() => null);
  }

  const modules = new ModuleRegistry({ events, store, settings, location });
  await modules.registerDefaults();

  return {
    services: { events, store, settings, location, geocoder, locationTriggers, install, modules, workspace },

    async start(root, { bootStartedAt = performance.now() } = {}) {
      if (firstRun) {
        let restoredLocal = false;
        const name = await runFirstIntro(root, bootStartedAt, {
          initialName: forceFirstIntro ? savedName : '',
          readPersonId: workspace.testMode ? undefined : async () => (await new ConnectionService(store).device()).personId,
          restoreBackup: workspace.testMode ? undefined : async (text, password, options) => {
            await new ConnectionService(store).restoreBackup(text, password, options);
            restoredLocal ||= options.withLocal;
          }
        });

        if (restoredLocal) await settings.load();
        if (!restoredLocal || !settings.get().profile?.name) await settings.update({ profile: { name } });

        startupLocation = location.checkNow({
          reason: 'first-run',
          maxAgeMs: 60_000,
          highAccuracy: false,
          browserMaxAgeMs: 60_000,
          timeoutMs: 4_000
        }).catch(() => null);
      } else {
        await runReturningIntro(root, bootStartedAt, savedName || 'daar');
      }

      let startModule = '';
      const current = settings.get();
      const showStory = forceStory || !current.onboarding?.storySeen;

      if (showStory) {
        const result = await runStory(root, {
          name: current.profile?.name || '',
          location,
          geocoder
        });

        const firstPlaceId = await saveFirstPlace(store, result);
        startModule = '';

        await settings.update({
          onboarding: {
            storySeen: true,
            firstModule: startModule,
            firstPlaceId
          }
        });

        events.emit('location.created', {
          id: firstPlaceId,
          source: 'onboarding'
        });
      }

      if (!workspace.testMode && await new ConnectionService(store).pending()) startModule = 'people';

      if (!workspace.testMode) {
        new ChainSyncService(store,{events}).start();
        const information = new InformationFeedbackService(store, new ConnectionService(store), {
          notify: detail => window.dispatchEvent(new CustomEvent('sharon-information-changed', {detail}))
        });
        information.start();
      }

      createShell(root, {
        workspace,
        geocoder,
        modules,
        location,
        events,
        store,
        settings,
        install,
        initialModule: startModule,
        initialLocationId: settings.get().onboarding?.firstPlaceId || ''
      });

      if (!workspace.testMode && params.get('catalog') === 'share') {
        openShopCatalog({store,categoryId:params.get('category'),collectionId:params.get('collection')});
        const clean=new URL(window.location.href);for(const key of ['catalog','category','collection'])clean.searchParams.delete(key);window.history.replaceState(null,'',clean);
      }

      if (connectionNotice) {
        const notice = document.createElement('p');
        notice.setAttribute('role', 'status'); notice.textContent = connectionNotice;
        root.querySelector('[data-view-outlet]')?.prepend(notice);
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          location.suspend();
        } else {
          location.resume();
          location.checkNow({
            reason: 'foreground',
            maxAgeMs: settings.get().location.foregroundMaxAgeMs,
            highAccuracy: false,
            browserMaxAgeMs: 30_000,
            timeoutMs: 4_000
          }).catch(() => {});
        }
      });

      events.emit('app.started', {
        at: Date.now(),
        name: settings.get().profile.name
      });

      return startupLocation;
    }
  };
}

async function saveFirstPlace(store, result) {
  const now = Date.now();
  let id;
  do { id = IdentifierService.create(); } while (await store.get('objects', id));
  const place = result.place ?? {};

  await store.put('objects', {
    id,
    externalId: id,
    type: 'location',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    data: {
      title: result.placeName || result.kindLabel || 'Plek',
      kind: result.kind || 'other',
      coordinates: {
        lat: Number(place.lat),
        lng: Number(place.lng),
        accuracy: Number(place.accuracy || 0)
      },
      address: {
        street: place.street || '',
        number: place.number || '',
        postcode: place.postcode || '',
        city: place.city || ''
      },
      radiusM: 100,
      source: 'onboarding'
    }
  });

  return id;
}
