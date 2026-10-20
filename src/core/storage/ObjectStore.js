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

  // Atomically create one credential across tabs; resolve only after commit.
  async getOrCreateMeta(key, createValue) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve, reject) => {
      const tx=this.#db.transaction('meta','readwrite');
      const table=tx.objectStore('meta');
      const request=table.get(key);
      let row;
      request.onsuccess=()=>{
        try {
          row=request.result;
          if(!row) { row={key,value:createValue()}; table.put(row); }
        } catch(error) { reject(error); tx.abort(); }
      };
      tx.oncomplete=()=>resolve(row);
      tx.onabort=()=>reject(tx.error || new Error('Opslaan is afgebroken.'));
    });
  }

  async setMeta(key, value) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction('meta','readwrite');
      tx.objectStore('meta').put({key,value});
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error || new Error('Opslaan is afgebroken.'));
    });
  }

  // Store a fetched page together with its cursor. Outgoing acknowledgements
  // never advance that cursor: they may arrive ahead of unseen incoming messages.
  async saveChatMessages(chatId, messages, cursor = null) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction(['objects','meta'],'readwrite');
      const objects=tx.objectStore('objects'), meta=tx.objectStore('meta');
      let failure=null;
      for(const message of messages) {
        const get=objects.get(message.id);
        get.onsuccess=()=>{
          const old=get.result;
          if(old && (old.type!=='chat-message'||old.chatId!==chatId||
              old.senderId!==message.senderId||old.text!==message.text)) {
            failure=new Error('Dit bericht heeft een conflicterende identiteit.');
            tx.abort();return;
          }
          objects.put(message);
        };
      }
      if(cursor!==null) {
        const key='connection.cursor.'+chatId;
        const get=meta.get(key);
        get.onsuccess=()=>meta.put({key,value:Math.max(get.result?.value||0,cursor)});
      }
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(failure||tx.error||new Error('Opslaan is afgebroken.'));
    });
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
