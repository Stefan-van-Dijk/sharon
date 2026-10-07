import { createApp } from './app.js?v=0.1.22';

const bootStartedAt = performance.now();
const app = await createApp();
await app.start(document.querySelector('#app'), { bootStartedAt });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js?v=0.1.22', {
      updateViaCache: 'none'
    }).then(registration => registration.update()).catch(console.error);
  });
}
