import { createApp } from './app.js?v=0.1.64';

// Register before the intro: app.start can finish after the window load event.
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('./service-worker.js?v=0.1.64', {
    updateViaCache: 'none'
  }).then(registration => registration.update()).catch(console.error);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

const bootStartedAt = performance.now();
const app = await createApp();
await app.start(document.querySelector('#app'), { bootStartedAt });
