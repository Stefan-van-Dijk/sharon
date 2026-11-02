const DEFAULTS = Object.freeze({
  profile: {
    name: ''
  },
  onboarding: {
    storySeen: false,
    firstModule: '',
    firstPlaceId: ''
  },
  services: {
    reverseGeocode: {
      endpoint: 'https://nominatim.openstreetmap.org'
    }
  },
  location: {
    activeTripIntervalMs: 60_000,
    idlePeriodicChecks: false,
    foregroundMaxAgeMs: 15_000
  },
  sharing: {
    updateMode: 'auto'
  }
});

export class SettingsService {
  #store;
  #events;
  #value = structuredClone(DEFAULTS);

  constructor(store, events) {
    this.#store = store;
    this.#events = events;
  }

  async load() {
    const saved = await this.#store.get('settings', 'app');
    if (saved?.value) this.#value = merge(DEFAULTS, saved.value);
    return this.get();
  }

  get() {
    return structuredClone(this.#value);
  }

  async update(patch) {
    this.#value = merge(this.#value, patch);
    await this.#store.put('settings', {
      key: 'app',
      value: this.#value,
      updatedAt: Date.now()
    });
    this.#events.emit('settings.changed', this.get());
    return this.get();
  }
}

function merge(base, patch) {
  const result = structuredClone(base);

  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = merge(result[key] ?? {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
