import { createApp } from './app.js';

const bootStartedAt = performance.now();
const app = await createApp();
await app.start(document.querySelector('#app'), { bootStartedAt });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}
