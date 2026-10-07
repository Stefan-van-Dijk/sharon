import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.1.29';
import { bindSwipeRows } from './SwipeRows.js?v=0.1.29';

export async function openLocationsView(root, {
  store,
  location,
  events,
  initialLocationId = '',
  setTitle = () => {}
}) {
  const objects = await store.getAll('objects');
  const locations = objects
    .filter(item => item.type === 'location' && !item.deletedAt)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (initialLocationId) {
    const selected = locations.find(item => item.id === initialLocationId);
    if (selected) {
      setTitle('Locatie');
      return openLocationEditor(root, {
        store,
        location,
        events,
        locationObject: selected,
        setTitle
      });
    }
  }

  setTitle('Locaties');

  root.innerHTML = `
    <section class="module-view locations-view">
      <section class="clean-list swipe-list" aria-label="Locaties" data-swipe-list>
        ${locations.length ? locations.map(item => `
          <div class="swipe-row" data-swipe-row="${item.id}">
            <div class="swipe-actions" aria-hidden="false">
              <button
                type="button"
                class="swipe-action-edit"
                data-swipe-edit
                aria-label="Bewerk ${escapeAttribute(item.data?.title || 'locatie')}"
              >Bewerk</button>
              <button
                type="button"
                class="swipe-action-delete"
                data-swipe-delete
                aria-label="Verwijder ${escapeAttribute(item.data?.title || 'locatie')}"
              >Verwijder</button>
            </div>

            <button type="button" class="clean-row swipe-surface" data-swipe-surface>
              <span>
                <strong>${escapeHtml(item.data?.title || 'Locatie')}</strong>
                <small>${escapeHtml(compactAddress(item.data?.address))}</small>
              </span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>
            </button>
          </div>
        `).join('') : '<p class="empty-state">Nog geen locaties.</p>'}
      </section>
    </section>
  `;

  const swipeList = root.querySelector('[data-swipe-list]');

  const openItem = async id => {
    const item = locations.find(locationItem => locationItem.id === id);
    if (!item) return;

    setTitle('Locatie');
    await openLocationEditor(root, {
      store,
      location,
      events,
      locationObject: item,
      setTitle
    });
  };

  if (swipeList) {
    bindSwipeRows(swipeList, {
      onOpen: openItem,
      onEdit: openItem,
      onDelete: async id => {
        await softDeleteLocation(store, id);
        events.emit('location.deleted', { id });

        await openLocationsView(root, {
          store,
          location,
          events,
          setTitle
        });
      }
    });
  }
}

async function softDeleteLocation(store, locationId) {
  const now = Date.now();
  const objects = await store.getAll('objects');
  const locationObject = objects.find(item =>
    item.id === locationId &&
    item.type === 'location' &&
    !item.deletedAt
  );

  if (locationObject) {
    await store.put('objects', {
      ...locationObject,
      updatedAt: now,
      deletedAt: now
    });
  }

  const linkedActions = objects.filter(item =>
    item.type === 'location-action' &&
    !item.deletedAt &&
    item.data?.locationId === locationId
  );

  for (const action of linkedActions) {
    await store.put('objects', {
      ...action,
      updatedAt: now,
      deletedAt: now,
      data: {
        ...action.data,
        enabled: false
      }
    });
  }
}

async function openLocationEditor(root, {
  store,
  location,
  events,
  locationObject,
  setTitle
}) {
  let current = locationObject;
  let action = await findAction(store, current.id);

  setTitle('Locatie');
  render();

  function render(statusText = '') {
    const data = current.data ?? {};
    const address = data.address ?? {};
    const trigger = action?.data ?? {};

    root.innerHTML = `
      <section class="module-view location-editor-view">
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
      </section>
    `;

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
