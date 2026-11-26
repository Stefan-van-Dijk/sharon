const DB_NAME = 'sharon';
const DB_VERSION = 1;

const backupTables = ['objects', 'tracks', 'settings', 'meta'];
const backupMeta = /^(?:agenda\.event-line\.bookmarks\.v1$|cards\.|connection\.(?:contact\.|read\.)|location\.|locations\.|notes\.|people\.list\.|shop\.view\.)/;

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

  // Atomic queue updates protect newer changes from delayed acknowledgements
  // and concurrent tabs. The reducer is synchronous inside one IDB transaction.
  async updateMeta(key, update) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction('meta', 'readwrite');
      const table = tx.objectStore('meta'), request = table.get(key);
      let value, failure;
      request.onsuccess = () => {
        try { value = update(request.result?.value); table.put({key, value}); }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure || tx.error || new Error('Opslaan is afgebroken.'));
    });
  }

  async upsertBranchLocation(branchId, update, sourceRef='') {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction('objects','readwrite'), table=tx.objectStore('objects');
      const request=table.getAll(); let record, failure;
      request.onsuccess=()=>{
        try {
          const records=request.result;
          const old=records.find(item=>item.type==='location'&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived'&&(item.data?.branchId===branchId||Boolean(sourceRef&&item.data?.sourceRef===sourceRef)));
          record=update(old);
          if (records.some(item=>item.id===record.id&&item.id!==old?.id)) throw Error('Conflicterende locatie-identiteit.');
          table.put(record);
        } catch(error){failure=error;tx.abort();}
      };
      tx.oncomplete=()=>resolve(record);
      tx.onabort=()=>reject(failure||tx.error||new Error('Opslaan is afgebroken.'));
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
          // Chat sync must preserve the sender's local source link. It is never
          // included in the server payload and cannot be reconstructed later.
          objects.put({...message,...(old?.sharedObjectId?{
            sharedObjectId:old.sharedObjectId,sharedRecipientName:old.sharedRecipientName||'',sharedRelatedIds:old.sharedRelatedIds||[],
            sharedConfirmedAt:message.sharedConfirmedAt||old.sharedConfirmedAt
          }:{})});
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

  async advanceChatRead(chatId, seq) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction('meta','readwrite'),table=tx.objectStore('meta');
      const key='connection.read.'+chatId,request=table.get(key);
      request.onsuccess=()=>table.put({key,value:Math.max(request.result?.value||0,seq)});
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('Leesstatus bewaren is afgebroken.'));
    });
  }

  // Reset only the network state in one transaction; personal records and
  // settings survive. Preserve the local identity and device credential.
  async resetConnectionState(deviceKey) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve,reject)=>{
      const tx=this.#db.transaction(['meta','objects'],'readwrite');
      const meta=tx.objectStore('meta'),objects=tx.objectStore('objects');
      const metadata=meta.openCursor();
      metadata.onsuccess=()=>{
        const cursor=metadata.result;if(!cursor)return;
        if(String(cursor.key).startsWith('connection.')) {
          if(cursor.key===deviceKey)cursor.update({...cursor.value,value:{...cursor.value.value,registered:false,self:null}});
          else cursor.delete();
        }
        cursor.continue();
      };
      const messages=objects.index('type').openCursor('chat-message');
      messages.onsuccess=()=>{const cursor=messages.result;if(cursor){cursor.delete();cursor.continue();}};
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error||new Error('Opnieuw instellen is afgebroken.'));
    });
  }

  async get(storeName, key) {
    return requestResult(this.#store(storeName).get(key));
  }

  // A successful IDB request is not a committed write: resolve only
  // after the entire transaction completes, including quota/abort handling.
  #write(storeName, operation) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = this.#db.transaction(storeName, 'readwrite');
        const request = operation(tx.objectStore(storeName));
        let result;
        request.onsuccess = () => { result = request.result; };
        // The transaction's abort/error handlers own rejection, preventing
        // a misleading request-level success before the commit.
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || request.error || new Error('Opslaan is afgebroken.'));
        tx.onerror = () => {}; // onabort supplies the final transaction error
      } catch (error) {
        reject(error);
      }
    });
  }

  async readLocalBackup() {
    const tx = this.#db.transaction(backupTables, 'readonly');
    const entries = await Promise.all(backupTables.map(async name => [
      name, await requestResult(tx.objectStore(name).getAll())
    ]));
    const data = Object.fromEntries(entries);
    data.meta = data.meta.filter(row => backupMeta.test(row.key));
    return data;
  }

  async restoreLocalBackup(data, deviceKey, previousKey, identity, assertIdentity) {
    for (const name of backupTables) {
      const key = name === 'objects' || name === 'tracks' ? 'id' : 'key';
      const rows = data ? data[name] : [];
      if (!Array.isArray(rows) || rows.some(row => typeof row?.[key] !== 'string' ||
          (name === 'meta' && !backupMeta.test(row.key)))) {
        throw Error('De lokale gegevens in deze back-up zijn ongeldig.');
      }
    }
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(backupTables, 'readwrite');
      const meta = tx.objectStore('meta');
      const settings = tx.objectStore('settings');
      const checks = [meta.get(deviceKey), meta.get(previousKey), tx.objectStore('objects').count(),
        tx.objectStore('tracks').count(), settings.get('app')];
      let failure;
      checks.at(-1).onsuccess = () => {
        try {
          const clean = !checks[2].result && !checks[3].result && !checks[4].result?.value?.profile?.name;
          const previous = checks[1].result?.value;
          assertIdentity(checks[0].result?.value ?? previous, clean && !previous);
          if (data && !clean) {
            throw Error('Zet lokale gegevens terug bij een schone installatie.');
          }
          for (const name of backupTables) {
            const table = tx.objectStore(name);
            for (const row of data?.[name] ?? []) table.put(row);
          }
          meta.put({ key: deviceKey, value: identity });
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure || tx.error || Error('Het terugzetten is afgebroken.'));
    });
  }

  async addTimeEntry(entry) {
    return this.#write('objects', table => table.add(entry));
  }

  async removeTimeEntry(id) {
    if (!this.#db) throw new Error('ObjectStore is nog niet geopend.');
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction('objects', 'readwrite');
      const table = tx.objectStore('objects');
      const request = table.get(id);
      request.onsuccess = () => {
        if (request.result?.type === 'time-entry') table.delete(id);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('Verwijderen is afgebroken.'));
    });
  }

  async put(storeName, value) {
    return this.#write(storeName, table => table.put(value));
  }

  async delete(storeName, key) {
    return this.#write(storeName, table => table.delete(key));
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
