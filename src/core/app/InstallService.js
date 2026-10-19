export class InstallService {
  #events;
  #deferredPrompt = null;
  #updateReady = false;

  constructor({ events }) {
    this.#events = events;

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.#deferredPrompt = event;
      this.#events.emit('install.available', this.getState());
    });

    window.addEventListener('appinstalled', () => {
      this.#deferredPrompt = null;
      this.#events.emit('install.completed', this.getState());
    });
  }

  getState() {
    return {
      installed: this.isInstalled(),
      canPrompt: Boolean(this.#deferredPrompt),
      updateReady: this.#updateReady,
      ios: isIos(),
      safari: isSafari()
    };
  }

  watchUpdates(registration) {
    const notify = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      this.#updateReady = true;
      this.#events.emit('app.update.ready', this.getState());
    };
    const installing = () => registration.installing?.addEventListener('statechange', notify);
    registration.addEventListener('updatefound', installing);
    installing();
    notify();
    let checkedAt = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || Date.now() - checkedAt < 5 * 60_000) return;
      checkedAt = Date.now();
      registration.update().catch(() => {});
    });
  }

  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  async prompt() {
    if (this.isInstalled()) {
      return { outcome: 'installed' };
    }

    if (!this.#deferredPrompt) {
      return { outcome: 'manual', ...this.getState() };
    }

    const promptEvent = this.#deferredPrompt;
    this.#deferredPrompt = null;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    this.#events.emit('install.choice', {
      outcome: choice.outcome
    });

    return {
      outcome: choice.outcome,
      ...this.getState()
    };
  }
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isSafari() {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/i.test(ua);
}
