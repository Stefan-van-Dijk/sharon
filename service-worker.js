const BUILD = '0.1.18';
const CACHE = `sharon-shell-${BUILD}`;
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest?v=0.1.18',
  './assets/sharon-mark.png?v=0.1.18',
  './src/main.js?v=0.1.18',
  './src/app.js?v=0.1.18',
  './src/core/app/InstallService.js?v=0.1.18',
  './src/core/location/ReverseGeocodeService.js?v=0.1.18',
  './src/core/location/LocationTriggerService.js?v=0.1.18',
  './src/ui/Boot.js?v=0.1.18',
  './src/ui/Story.js?v=0.1.18',
  './src/ui/LocationsView.js?v=0.1.18',
  './src/ui/SettingsView.js?v=0.1.18',
  './src/ui/Shell.js?v=0.1.18'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async path => {
      try {
        const response = await fetch(new Request(path, { cache: 'reload' }));
        if (response.ok) await cache.put(path, response);
      } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('sharon-shell-') && key !== CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const response = await fetch(new Request(event.request, { cache: 'reload' }));

      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone()).catch(() => {});
      }

      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      if (event.request.mode === 'navigate') {
        const fallback =
          await caches.match('./index.html') ||
          await caches.match('./');
        if (fallback) return fallback;
      }

      throw error;
    }
  })());
});
