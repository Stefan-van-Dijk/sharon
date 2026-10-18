import { createApp } from './app.js?v=0.3.49';
// Use one measured viewport height throughout Sharon. iOS standalone PWAs can
// report a stale CSS 100dvh after opening, resuming or rotating the device.
const syncViewportHeight = () => {
  const height = window.visualViewport?.height || window.innerHeight;
  if (height > 0) document.documentElement.style.setProperty('--sharon-viewport-height', height + 'px');
};
if (document.documentElement) syncViewportHeight();
if (document.documentElement) window.addEventListener('resize', syncViewportHeight, {passive:true});
if (document.documentElement) window.visualViewport?.addEventListener('resize', syncViewportHeight, {passive:true});
if (document.documentElement) window.addEventListener('pageshow', syncViewportHeight, {passive:true});
if (document.documentElement) document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncViewportHeight();
});



// Register before the intro: app.start can finish after the window load event.
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('./service-worker.js?v=0.3.49', {
    updateViaCache: 'none'
  }).then(registration => registration.update()).catch(console.error);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

const bootStartedAt = performance.now();
const app = await createApp();
await app.start(document.querySelector('#app'), { bootStartedAt });
