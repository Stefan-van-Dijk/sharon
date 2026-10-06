import { EventBus } from './core/events/EventBus.js';
import { ObjectStore } from './core/storage/ObjectStore.js';
import { SettingsService } from './core/settings/SettingsService.js';
import { LocationService } from './core/location/LocationService.js';
import { ModuleRegistry } from './modules/ModuleRegistry.js';
import { createShell } from './ui/Shell.js';

export async function createApp() {
  const events = new EventBus();
  const store = new ObjectStore();
  const settings = new SettingsService(store, events);
  const location = new LocationService({ events, settings });

  // Start een zuinige locatiecontrole direct tijdens het laden.
  // De app wacht hier bewust niet op.
  const startupLocation = location.checkNow({
    reason: 'startup',
    maxAgeMs: 60_000,
    highAccuracy: false,
    browserMaxAgeMs: 60_000,
    timeoutMs: 4_000
  }).catch(() => null);

  await store.open();
  await settings.load();

  const modules = new ModuleRegistry({ events, store, settings, location });
  await modules.registerDefaults();

  return {
    services: { events, store, settings, location, modules },
    startupLocation,

    async start(root) {
      createShell(root, { modules, location, events });

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

      events.emit('app.started', { at: Date.now() });
    }
  };
}
