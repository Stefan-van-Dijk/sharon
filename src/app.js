import { EventBus } from './core/events/EventBus.js';
import { ObjectStore } from './core/storage/ObjectStore.js';
import { SettingsService } from './core/settings/SettingsService.js';
import { LocationService } from './core/location/LocationService.js';
import { ModuleRegistry } from './modules/ModuleRegistry.js';
import { createShell } from './ui/Shell.js';

export async function createApp() {
  const events = new EventBus();
  const store = new ObjectStore();
  await store.open();

  const settings = new SettingsService(store, events);
  await settings.load();

  const location = new LocationService({ events, settings });
  const modules = new ModuleRegistry({ events, store, settings, location });
  await modules.registerDefaults();

  return {
    services: { events, store, settings, location, modules },

    async start(root) {
      createShell(root, { modules, location, events });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          location.suspend();
        } else {
          location.resume();
          location.checkNow({
            reason: 'foreground',
            maxAgeMs: settings.get().location.foregroundMaxAgeMs
          }).catch(() => {});
        }
      });

      events.emit('app.started', { at: Date.now() });
    }
  };
}
