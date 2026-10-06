export class LocationTriggerService {
  #store;
  #events;
  #unsubscribe = null;
  #running = false;

  constructor({ store, events }) {
    this.#store = store;
    this.#events = events;
  }

  start() {
    if (this.#unsubscribe) return;
    this.#unsubscribe = this.#events.on('location.changed', event => {
      this.evaluate(event.detail).catch(error => {
        console.error('LocationTriggerService', error);
      });
    });
  }

  stop() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async evaluate(point) {
    if (this.#running || !isFinitePoint(point)) return;
    this.#running = true;

    try {
      const objects = await this.#store.getAll('objects');
      const locations = new Map(
        objects
          .filter(item => item.type === 'location' && !item.deletedAt)
          .map(item => [item.id, item])
      );

      const actions = objects.filter(item =>
        item.type === 'location-action' &&
        !item.deletedAt &&
        item.data?.enabled !== false
      );

      for (const action of actions) {
        const target = locations.get(action.data?.locationId);
        if (!target) continue;

        const coordinates = target.data?.coordinates ?? {};
        if (!isFinitePoint(coordinates)) continue;

        const radius = clampRadius(target.data?.radiusM);
        const distanceM = distanceBetween(point, coordinates);
        const inside = distanceM <= radius;

        const previous = action.data?.state?.inside;
        const nextState = {
          inside,
          distanceM: Math.round(distanceM),
          checkedAt: Date.now()
        };

        // De eerste waarneming is alleen de uitgangssituatie.
        // Een trigger mag pas afgaan na een echte buiten -> binnen overgang.
        const shouldFire =
          previous === false &&
          inside === true &&
          action.data?.event === 'enter';

        if (previous !== inside || !action.data?.state) {
          await this.#store.put('objects', {
            ...action,
            updatedAt: Date.now(),
            data: {
              ...action.data,
              state: nextState,
              lastTriggeredAt: shouldFire
                ? Date.now()
                : action.data?.lastTriggeredAt ?? null
            }
          });
        }

        if (shouldFire) {
          this.#events.emit('trigger.fired', {
            actionId: action.id,
            locationId: target.id,
            locationTitle: target.data?.title || 'Locatie',
            message:
              action.data?.message ||
              `Je bent bij ${target.data?.title || 'de locatie'}.`,
            distanceM: Math.round(distanceM)
          });
        }
      }
    } finally {
      this.#running = false;
    }
  }
}

export function distanceBetween(a, b) {
  const earthRadiusM = 6_371_000;
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(value) {
  return value * Math.PI / 180;
}

function isFinitePoint(point) {
  return Number.isFinite(Number(point?.lat)) &&
    Number.isFinite(Number(point?.lng));
}

function clampRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(2000, Math.max(20, number));
}
