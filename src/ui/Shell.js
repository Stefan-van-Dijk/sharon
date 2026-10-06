export function createShell(root, { modules, location, events, initialModule = '' }) {
  const list = modules.list();

  root.innerHTML = `
    <main class="shell">
      <header class="brand">
        <div class="brand-line">
          <div class="brand-wordmark" data-menu-anchor aria-label="Sharon">
            <span>Shar</span>
            <img
              class="brand-wordmark-mark"
              src="./assets/sharon-mark.png?v=0.1.15"
              alt=""
              aria-hidden="true"
            >
            <span>n</span>
          </div>
          <span
            class="location-pulse is-searching"
            data-location-status
            title="Locatie wordt bepaald"
            aria-label="Locatie wordt bepaald"
          ></span>
        </div>
      </header>

      <nav class="module-list" aria-label="Onderdelen">
        ${list.map(module => `
          <button class="module-row" data-module="${module.id}">
            <span>${module.title}</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7.5 4.5 13 10l-5.5 5.5"/>
            </svg>
          </button>
        `).join('')}
      </nav>

      <footer class="shell-footer">
        <span class="location-state" data-message>Locatie wordt bij openen gecontroleerd.</span>
        <button type="button" class="quiet-action" data-location-check>Ververs locatie</button>
      </footer>
    </main>
  `;

  const message = root.querySelector('[data-message]');
  const status = root.querySelector('[data-location-status]');

  const setSearching = () => {
    status.classList.remove('is-ready');
    status.classList.add('is-searching');
    status.title = 'Locatie wordt bepaald';
    status.setAttribute('aria-label', 'Locatie wordt bepaald');
  };

  const setReady = () => {
    status.classList.remove('is-searching');
    status.classList.add('is-ready');
    status.title = 'Locatie beschikbaar';
    status.setAttribute('aria-label', 'Locatie beschikbaar');
  };

  root.querySelector('[data-location-check]').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    setSearching();
    message.textContent = 'Locatie controleren…';

    try {
      const point = await location.checkNow({
        reason: 'manual',
        maxAgeMs: 0,
        highAccuracy: true
      });
      setReady();
      message.textContent =
        `Locatie beschikbaar · ±${Math.round(point.accuracy)} m`;
    } catch (error) {
      status.classList.remove('is-searching');
      message.textContent = error.message;
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  events.on('location.changed', event => {
    setReady();
    const accuracy = Math.round(event.detail?.accuracy ?? 0);
    message.textContent = accuracy
      ? `Locatie beschikbaar · ±${accuracy} m`
      : 'Locatie beschikbaar';
  });

  const existing = location.latest;
  if (existing) {
    setReady();
    message.textContent = `Locatie beschikbaar · ±${Math.round(existing.accuracy)} m`;
  } else if (initialModule) {
    const selected = modules.get(initialModule);
    if (selected) message.textContent = `Je start bij ${selected.title}.`;
  }

  root.querySelectorAll('[data-module]').forEach(button => {
    button.addEventListener('click', () => {
      const module = modules.get(button.dataset.module);
      message.textContent =
        `${module.title} wordt als volgende stap uitgewerkt.`;
    });
  });
}
