export function createShell(root, { modules, location, events }) {
  const list = modules.list();

  root.innerHTML = `
    <main class="shell">
      <header class="brand">
        <div class="brand-line">
          <div>
            <small>SHARE ON</small>
            <h1>Sharon</h1>
          </div>
          <span class="status-dot" data-location-status title="Locatie nog niet gecontroleerd"></span>
        </div>
        <p>Vastleggen, verbinden en delen.</p>
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

  const status = root.querySelector('[data-location-status]');
  const message = root.querySelector('[data-message]');

  root.querySelector('[data-location-check]').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    message.textContent = 'Locatie controleren…';

    try {
      const point = await location.checkNow({
        reason: 'manual',
        maxAgeMs: 0,
        highAccuracy: true
      });
      message.textContent =
        `Locatie beschikbaar · ±${Math.round(point.accuracy)} m`;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  events.on('location.changed', event => {
    status.classList.add('ok');
    status.title = 'Locatie beschikbaar';

    const accuracy = Math.round(event.detail?.accuracy ?? 0);
    message.textContent = accuracy
      ? `Locatie beschikbaar · ±${accuracy} m`
      : 'Locatie beschikbaar';
  });

  const existing = location.latest;
  if (existing) {
    status.classList.add('ok');
    status.title = 'Locatie beschikbaar';
    message.textContent = `Locatie beschikbaar · ±${Math.round(existing.accuracy)} m`;
  }

  root.querySelectorAll('[data-module]').forEach(button => {
    button.addEventListener('click', () => {
      const module = modules.get(button.dataset.module);
      message.textContent =
        `${module.title} wordt als volgende stap uitgewerkt.`;
    });
  });
}
