import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.1.16';

export async function openLocationsView(root, {
  store,
  location,
  events,
  initialLocationId = '',
  onBack
}) {
  const objects = await store.getAll('objects');
  const locations = objects
    .filter(item => item.type === 'location' && !item.deletedAt)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (initialLocationId) {
    const selected = locations.find(item => item.id === initialLocationId);
    if (selected) {
      return openLocationEditor(root, {
        store,
        location,
        events,
        locationObject: selected,
        onBack
      });
    }
  }

  root.innerHTML = `
    <main class="detail-shell">
      ${detailHeader('Locaties')}
      <section class="clean-list" aria-label="Locaties">
        ${locations.length ? locations.map(item => `
          <button type="button" class="clean-row" data-location-id="${item.id}">
            <span>
              <strong>${escapeHtml(item.data?.title || 'Locatie')}</strong>
              <small>${escapeHtml(compactAddress(item.data?.address))}</small>
            </span>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>
          </button>
        `).join('') : '<p class="empty-state">Nog geen locaties.</p>'}
      </section>
    </main>
  `;

  root.querySelector('[data-detail-back]').addEventListener('click', onBack);

  root.querySelectorAll('[data-location-id]').forEach(button => {
    button.addEventListener('click', async () => {
      const item = locations.find(locationItem => locationItem.id === button.dataset.locationId);
      if (!item) return;

      await openLocationEditor(root, {
        store,
        location,
        events,
        locationObject: item,
        onBack
      });
    });
  });
}

async function openLocationEditor(root, {
  store,
  location,
  events,
  locationObject,
  onBack
}) {
  let current = locationObject;
  let action = await findAction(store, current.id);

  render();

  function render(statusText = '') {
    const data = current.data ?? {};
    const address = data.address ?? {};
    const trigger = action?.data ?? {};

    root.innerHTML = `
      <main class="detail-shell">
        ${detailHeader('Locatie')}

        <form class="location-form" data-location-form>
          <label class="clean-field">
            <span>Naam</span>
            <input name="title" type="text" maxlength="80" value="${escapeAttribute(data.title || '')}" required>
          </label>

          <div class="clean-readonly">
            <span>Adres</span>
            <strong>${escapeHtml([address.street, address.number].filter(Boolean).join(' ') || 'Geen straatadres')}</strong>
            <small>${escapeHtml([address.postcode, address.city].filter(Boolean).join(' '))}</small>
          </div>

          <div class="clean-readonly">
            <span>Coördinaten</span>
            <strong class="mono">${formatCoordinates(data.coordinates)}</strong>
          </div>

          <label class="clean-field radius-field">
            <span>Herkenningsstraal</span>
            <div>
              <input name="radiusM" type="number" inputmode="numeric" min="20" max="2000" step="10" value="${clampRadius(data.radiusM)}">
              <em>meter</em>
            </div>
          </label>

          <section class="clean-section">
            <div class="section-heading">
              <span>Trigger bij binnenkomst</span>
              <label class="mini-switch">
                <input name="triggerEnabled" type="checkbox" ${trigger.enabled ? 'checked' : ''}>
                <span aria-hidden="true"></span>
              </label>
            </div>

            <label class="clean-field trigger-message">
              <span>Melding</span>
              <input
                name="triggerMessage"
                type="text"
                maxlength="160"
                value="${escapeAttribute(trigger.message || `Je bent bij ${data.title || 'deze plek'}.`)}"
              >
            </label>

            <p class="clean-help">
              De eerste waarneming bepaalt alleen of je binnen of buiten bent.
              De trigger start pas nadat Sharon eerst buiten en daarna weer binnen waarneemt.
            </p>
          </section>

          <div class="location-check">
            <button type="button" class="text-action" data-check-distance>Controleer nu</button>
            <span data-distance-status>${escapeHtml(statusText)}</span>
          </div>

          <button type="submit" class="primary-line-action">Bewaar</button>
        </form>
      </main>
    `;

    root.querySelector('[data-detail-back]').addEventListener('click', onBack);
    root.querySelector('[data-location-form]').addEventListener('submit', save);
    root.querySelector('[data-check-distance]').addEventListener('click', checkDistance);
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const now = Date.now();
    const title = String(values.get('title') || '').trim() || 'Locatie';
    const radiusM = clampRadius(values.get('radiusM'));
    const triggerEnabled = values.get('triggerEnabled') === 'on';
    const message =
      String(values.get('triggerMessage') || '').trim() ||
      `Je bent bij ${title}.`;

    current = {
      ...current,
      updatedAt: now,
      data: {
        ...current.data,
        title,
        radiusM
      }
    };

    await store.put('objects', current);

    if (action || triggerEnabled) {
      action = {
        ...(action || {
          id: crypto.randomUUID(),
          externalId: null,
          type: 'location-action',
          schemaVersion: 1,
          createdAt: now,
          deletedAt: null
        }),
        updatedAt: now,
        data: {
          ...(action?.data || {}),
          locationId: current.id,
          event: 'enter',
          enabled: triggerEnabled,
          message,
          state: action?.data?.state ?? null
        }
      };

      await store.put('objects', action);
    }

    events.emit('location.updated', { id: current.id });
    events.emit('location-action.updated', {
      locationId: current.id,
      enabled: triggerEnabled
    });

    render('Bewaard');
  }

  async function checkDistance(event) {
    const button = event.currentTarget;
    const status = root.querySelector('[data-distance-status]');
    button.disabled = true;
    status.textContent = 'Controleren…';

    try {
      const point = await location.checkNow({
        reason: 'location-detail',
        maxAgeMs: 0,
        highAccuracy: true,
        browserMaxAgeMs: 0,
        timeoutMs: 10_000
      });

      const target = current.data?.coordinates ?? {};
      const distanceM = distanceBetween(point, target);
      const radiusM = clampRadius(current.data?.radiusM);
      const inside = distanceM <= radiusM;

      status.textContent =
        `${Math.round(distanceM)} m · ${inside ? 'binnen straal' : 'buiten straal'}`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }
}

async function findAction(store, locationId) {
  const objects = await store.getAll('objects');
  return objects.find(item =>
    item.type === 'location-action' &&
    !item.deletedAt &&
    item.data?.locationId === locationId
  ) || null;
}

function detailHeader(title) {
  return `
    <header class="detail-header">
      <button type="button" class="back-action" data-detail-back aria-label="Terug">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4.5-5.5 5.5 5.5 5.5"/></svg>
      </button>
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

function compactAddress(address = {}) {
  const line1 = [address.street, address.number].filter(Boolean).join(' ');
  const line2 = [address.postcode, address.city].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(' · ');
}

function formatCoordinates(point = {}) {
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function clampRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(2000, Math.max(20, Math.round(number)));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
