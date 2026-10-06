export function createShell(root, { modules, location, events }) {
  const list = modules.list();

  root.innerHTML = `
    <main class="shell">
      <header class="top-card">
        <div>
          <small>SHARE ON</small>
          <h1>Sharon</h1>
          <p>Vastleggen voor jezelf. Verbinden wanneer het helpt. Delen wanneer jij dat wilt.</p>
        </div>
        <span class="status-dot" data-location-status title="Locatie nog niet gecontroleerd"></span>
      </header>

      <section class="module-grid">
        ${list.map(module => `
          <button class="module-card" data-module="${module.id}">
            <span class="module-icon">${module.icon}</span>
            <span>${module.title}</span>
          </button>
        `).join('')}
      </section>

      <section class="status-card">
        <strong>Nieuwe kern actief</strong>
        <span data-message>Geen periodieke GPS-controle buiten een actieve rit.</span>
        <button type="button" data-location-check>Locatie één keer controleren</button>
      </section>
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
        `Locatie ontvangen · nauwkeurigheid ±${Math.round(point.accuracy)} m`;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  events.on('location.changed', () => {
    status.classList.add('ok');
    status.title = 'Locatie beschikbaar';
  });

  root.querySelectorAll('[data-module]').forEach(button => {
    button.addEventListener('click', () => {
      const module = modules.get(button.dataset.module);
      message.textContent =
        `${module.title}: klaar om als zelfstandige Sharon-module uit te werken.`;
    });
  });
}
