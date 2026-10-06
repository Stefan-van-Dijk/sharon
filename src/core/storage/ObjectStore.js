const DB_NAME = 'sharon';
const DB_VERSION = 1;

export class ObjectStore {
  #db = null;

  async open() {
    if (this.#db) return this;

    this.#db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('objects')) {
          const objects = db.createObjectStore('objects', { keyPath: 'id' });
          objects.createIndex('type', 'type', { unique: false });
          objects.createIndex('externalId', 'externalId', { unique: false });
          objects.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('events')) {
          const events = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
          events.createIndex('at', 'at', { unique: false });
          events.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('tracks')) {
          const tracks = db.createObjectStore('tracks', { keyPath: 'id' });
          tracks.createIndex('rideId', 'rideId', { unique: false });
        }

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this;
  }

  #store(name, mode = 'readonly') {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return this.#db.transaction(name, mode).objectStore(name);
  }

  async get(storeName, key) {
    return requestResult(this.#store(storeName).get(key));
  }

  async put(storeName, value) {
    return requestResult(this.#store(storeName, 'readwrite').put(value));
  }

  async delete(storeName, key) {
    return requestResult(this.#store(storeName, 'readwrite').delete(key));
  }

  async getAll(storeName) {
    return requestResult(this.#store(storeName).getAll());
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
