import { locationPolicy } from './LocationPolicy.js';

export class LocationService {
  #events;
  #settings;
  #latest = null;
  #pending = null;
  #tripId = null;
  #locationActionConsumers = 0;
  #timer = null;
  #suspended = false;

  constructor({ events, settings }) {
    this.#events = events;
    this.#settings = settings;
  }

  get latest() {
    return this.#latest ? structuredClone(this.#latest) : null;
  }

  setActiveTrip(tripId) {
    this.#tripId = tripId || null;
    this.#reschedule();
  }

  registerLocationActionConsumer() {
    this.#locationActionConsumers += 1;
    this.#reschedule();

    return () => {
      this.#locationActionConsumers = Math.max(0, this.#locationActionConsumers - 1);
      this.#reschedule();
    };
  }

  suspend() {
    this.#suspended = true;
    this.#clearTimer();
  }

  resume() {
    this.#suspended = false;
    this.#reschedule();
  }

  async checkNow({
    reason = 'manual',
    maxAgeMs = 0,
    highAccuracy = null,
    browserMaxAgeMs = null,
    timeoutMs = null
  } = {}) {
    if (this.#suspended || document.hidden) {
      throw new Error('Locatiecontrole is gepauzeerd zolang Sharon niet zichtbaar is.');
    }

    const age = this.#latest ? Date.now() - this.#latest.at : Infinity;
    if (age <= maxAgeMs) return this.latest;
    if (this.#pending) return this.#pending;

    const policy = locationPolicy({
      hidden: this.#suspended || document.hidden,
      activeTrip: Boolean(this.#tripId),
      activeLocationActions: this.#locationActionConsumers > 0,
      manual: reason === 'manual'
    });

    const accurate = highAccuracy ?? policy.highAccuracy;
    const maximumAge =
      browserMaxAgeMs ?? (accurate ? 0 : 30_000);
    const timeout =
      timeoutMs ?? (accurate ? 12_000 : 8_000);

    this.#pending = this.#readPosition({
      highAccuracy: accurate,
      maximumAge,
      timeout
    })
      .then(position => {
        this.#latest = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: position.timestamp || Date.now(),
          reason
        };
        this.#events.emit('location.changed', this.latest);
        return this.latest;
      })
      .finally(() => {
        this.#pending = null;
      });

    return this.#pending;
  }

  #readPosition({ highAccuracy, maximumAge, timeout }) {
    if (!navigator.geolocation) {
      return Promise.reject(new Error('GPS wordt niet ondersteund.'));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: Boolean(highAccuracy),
        maximumAge: Math.max(0, Number(maximumAge) || 0),
        timeout: Math.max(1_000, Number(timeout) || 8_000)
      });
    });
  }

  #reschedule() {
    this.#clearTimer();
    if (this.#suspended || document.hidden || !this.#tripId) return;

    const intervalMs =
      this.#settings.get().location.activeTripIntervalMs ?? 60_000;

    this.#timer = setTimeout(async () => {
      this.#timer = null;

      try {
        await this.checkNow({
          reason: 'active-trip',
          maxAgeMs: 0,
          highAccuracy: true,
          browserMaxAgeMs: 0,
          timeoutMs: 12_000
        });
      } catch {}

      this.#reschedule();
    }, intervalMs);
  }

  #clearTimer() {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
