import { EventBus } from './core/events/EventBus.js?v=0.1.7';
import { ObjectStore } from './core/storage/ObjectStore.js?v=0.1.7';
import { SettingsService } from './core/settings/SettingsService.js?v=0.1.7';
import { LocationService } from './core/location/LocationService.js?v=0.1.7';
import { ModuleRegistry } from './modules/ModuleRegistry.js?v=0.1.7';
import { createShell } from './ui/Shell.js?v=0.1.7';
import { runFirstIntro, runReturningIntro } from './ui/Boot.js?v=0.1.7';

export async function createApp() {
  const events = new EventBus();
  const store = new ObjectStore();
  const settings = new SettingsService(store, events);

  await store.open();
  await settings.load();

  const location = new LocationService({ events, settings });
  const savedName = String(settings.get().profile?.name || '').trim();
  const introMode = new URLSearchParams(window.location.search).get('intro');
  const forceFirstIntro = introMode === '1';
  const forceKnownIntro = introMode === 'known';
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
    services: { events, store, settings, location, modules },

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

      events.emit('app.started', {
        at: Date.now(),
        name: settings.get().profile.name
      });

      return startupLocation;
    }
  };
}
