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
  },
  mapDisplay: {
    showIcons: true, showNames: true, clusterPoints: true, allowRotation: false, pointSize: 5,
    iconSize: 20, nameSize: 12, showPoints: true,
    readStyle: 'transparent', likedStyle: 'red-border'
  }
});

export class SettingsService {
  #store;
  #events;
  #writes = Promise.resolve();
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

  update(patch) {
    const snapshot = structuredClone(patch);
    const write = this.#writes.then(() => this.#commit(snapshot));
    this.#writes = write.catch(() => {});
    return write;
  }

  async #commit(patch) {
    const next = merge(this.#value, patch);
    await this.#store.put('settings', {
      key: 'app',
      value: next,
      updatedAt: Date.now()
    });
    this.#value = next;
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
