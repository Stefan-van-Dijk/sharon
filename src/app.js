import { EventBus } from './core/events/EventBus.js?v=0.1.16';
import { ObjectStore } from './core/storage/ObjectStore.js?v=0.1.16';
import { SettingsService } from './core/settings/SettingsService.js?v=0.1.16';
import { LocationService } from './core/location/LocationService.js?v=0.1.16';
import { ReverseGeocodeService } from './core/location/ReverseGeocodeService.js?v=0.1.16';
import { LocationTriggerService } from './core/location/LocationTriggerService.js?v=0.1.16';
import { ModuleRegistry } from './modules/ModuleRegistry.js?v=0.1.16';
import { createShell } from './ui/Shell.js?v=0.1.16';
import { runFirstIntro, runReturningIntro } from './ui/Boot.js?v=0.1.16';
import { runStory } from './ui/Story.js?v=0.1.16';

export async function createApp() {
  const events = new EventBus();
  const store = new ObjectStore();
  const settings = new SettingsService(store, events);

  await store.open();
  await settings.load();

  const location = new LocationService({ events, settings });
  const initialSettings = settings.get();
  const geocoder = new ReverseGeocodeService({
    endpoint: initialSettings.services?.reverseGeocode?.endpoint
  });
  const locationTriggers = new LocationTriggerService({ store, events });
  locationTriggers.start();

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
    services: { events, store, settings, location, geocoder, locationTriggers, modules },

    async start(root, { bootStartedAt = performance.now() } = {}) {
      if (firstRun) {
        const name = await runFirstIntro(root, bootStartedAt, {
          initialName: forceFirstIntro ? savedName : ''
        });

        await settings.update({ profile: { name } });

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
        startModule = 'locations';

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

      createShell(root, {
        modules,
        location,
        events,
        store,
        initialModule: startModule,
        initialLocationId: settings.get().onboarding?.firstPlaceId || ''
      });

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
  const id = crypto.randomUUID();
  const place = result.place ?? {};

  await store.put('objects', {
    id,
    externalId: null,
    type: 'location',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    data: {
      title: result.kindLabel || 'Plek',
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
