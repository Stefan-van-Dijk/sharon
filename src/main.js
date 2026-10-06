import { createApp } from './app.js';

const app = await createApp();
await app.start(document.querySelector('#app'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}
