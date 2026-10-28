import { createApp } from './app.js?v=0.4.23';
import { syncViewportHeight } from './ui/Viewport.js?v=0.4.23';
if (document.documentElement) syncViewportHeight();
if (document.documentElement) window.addEventListener('resize', syncViewportHeight, {passive:true});
if (document.documentElement) window.addEventListener('orientationchange', syncViewportHeight, {passive:true});
if (document.documentElement) document.addEventListener('focusout', () => requestAnimationFrame(syncViewportHeight));
if (document.documentElement) window.visualViewport?.addEventListener('resize', syncViewportHeight, {passive:true});
if (document.documentElement) window.addEventListener('pageshow', syncViewportHeight, {passive:true});
if (document.documentElement) document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncViewportHeight();
});



const bootStartedAt = performance.now();
const app = await createApp();

// Register before the intro: app.start can finish after the window load event.
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('./service-worker.js?v=0.4.23', {
    updateViaCache: 'none'
  }).then(registration => {
    app.services.install.watchUpdates(registration);
    return registration.update();
  }).catch(() => { /* Offline startup must not fail because an update is unavailable. */ });
  register();
}

await app.start(document.querySelector('#app'), { bootStartedAt });
