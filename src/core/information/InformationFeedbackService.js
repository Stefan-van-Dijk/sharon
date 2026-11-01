import { informationReference, informationKey, feedbackState } from './InformationItem.js?v=0.4.55';
const PREFIX = 'information.feedback.v1:';
let activeService = null;
export const informationFeedback = () => activeService;

export class InformationFeedbackService {
  constructor(store, connection, {notify = () => {}} = {}) {
    this.store = store; this.connection = connection; this.notify = notify;
    this.summaries = new Map(); this.running = null; this.ready = Promise.resolve();
  }
  async key(reference) {
    const device = await this.connection.device();
    return PREFIX + device.personId + ':' + informationKey(reference);
  }
  summary(reference) { return this.summaries.get(informationKey(reference)); }
  async set(reference, patch) {
    reference = informationReference(reference);
    const key = await this.key(reference);
    const row = await this.store.updateMeta(key, old => {
      const state = feedbackState({...old?.state, ...patch});
      // Opening is a unique-user measure, never a repeat-open counter.
      state.opened = !!(old?.state?.opened || state.opened);
      if (old && JSON.stringify(state) === JSON.stringify(old.state)) return old;
      return {...old, reference, state, version:old?.version || 0,
        operation:crypto.randomUUID(), dirty:true};
    });
    this.notify({reference, pending:row.dirty});
    void this.flush();
    return row;
  }
  async open(reference, legacy = {}) {
    await this.ready;
    const old = (await this.store.get('meta', await this.key(reference)))?.value;
    const remote = this.summary(reference);
    const state = old?.dirty ? old.state : remote?.version > (old?.version || 0) ? remote.own : old?.state || legacy;
    return this.set(reference, {...state, opened:true});
  }
  async migrateWikipedia(storage) {
    if (!storage) return;
    for (let i = 0; i < storage.length; i++) {
      const name = storage.key(i);
      if (!/^sharon\.wiki\.feedback\.v1:Q[1-9][0-9]*$/.test(name || '')) continue;
      const reference = informationReference({source:'wikipedia', id:name.split(':').pop()});
      if (await this.store.get('meta', await this.key(reference))) continue;
      let value;
      try { value = JSON.parse(storage.getItem(name)); } catch { continue; }
      if (value && typeof value === 'object') await this.set(reference, value);
    }
  }
  async load(references) {
    await this.ready;
    const device = await this.connection.device();
    if (!device.registered || !device.self) return;
    const unique = [...new Map(references.map(value => {
      const ref = informationReference(value); return [informationKey(ref), ref];
    })).values()];
    for (let i = 0; i < unique.length; i += 40) {
      const data = await this.connection.request('information-summary', {items:unique.slice(i,i+40)}, device);
      for (const summary of data.items || []) {
        const key = await this.key(summary.reference);
        const saved = await this.store.updateMeta(key, old => {
          if ((old?.summary?.revision || 0) > (summary.revision || 0)) return old;
          const row = {...old, reference:summary.reference, summary};
          if (!old?.dirty && summary.version >= (old?.version || 0)) {
            row.state = feedbackState(summary.own); row.version = summary.version; row.dirty = false;
          }
          return row;
        });
        this.summaries.set(informationKey(summary.reference), saved.summary);
      }
    }
    this.notify({loaded:true});
  }
  async canManage() { return (await this.connection.device()).self?.line === 0; }
  async setPolicy(reference, policy, context) {
    const device = await this.connection.device();
    const data = await this.connection.request('information-policy', {item:informationReference(reference), policy, context}, device);
    const saved = await this.store.updateMeta(await this.key(reference), old => ({...old, reference,
      summary:(old?.summary?.revision || 0) > (data.item.revision || 0) ? old.summary : data.item}));
    this.summaries.set(informationKey(reference), saved.summary);
    this.notify({reference});
    return data.item;
  }
  async flush() {
    if (this.running) return this.running;
    this.running = this.flushQueue().catch(error => { this.notify({pending:true, error:error.message}); })
      .finally(() => { this.running = null; });
    return this.running;
  }
  async flushQueue() {
    await this.ready;
    const device = await this.connection.device();
    if (!device.registered || !device.self || globalThis.navigator?.onLine === false) return;
    const prefix = PREFIX + device.personId + ':';
    const rows = (await this.store.getAll('meta')).filter(row => row.key.startsWith(prefix) && row.value.dirty).slice(0,30);
    for (const {key, value:sent} of rows) {
      const data = await this.connection.request('information-feedback', {
        item:sent.reference, state:sent.state, operation:sent.operation, version:sent.version
      }, device);
      if (typeof data.accepted !== 'boolean' || !Number.isSafeInteger(data.version) || data.version < 0)
        throw Error('Ongeldig antwoord bij waardering.');
      const saved = await this.store.updateMeta(key, current => ({...current,
        version:Math.max(current.version, data.version),
        summary:(current.summary?.revision || 0) > (data.item.revision || 0) ? current.summary : data.item, dirty: !(data.accepted && current.operation === sent.operation)
      }));
      this.summaries.set(informationKey(sent.reference), saved.summary);
      this.notify({reference:sent.reference, pending:saved.dirty});
    }
  }
  start(target = window) {
    activeService = this;
    this.ready = (async () => {
      await this.migrateWikipedia(target.localStorage);
      const prefix = PREFIX + (await this.connection.device()).personId + ':';
      for (const row of await this.store.getAll('meta')) if (row.key.startsWith(prefix) && row.value.summary)
        this.summaries.set(informationKey(row.value.reference), row.value.summary);
    })().catch(error => this.notify({pending:true,error:error.message}));
    const flush = () => { if (target.document?.visibilityState !== 'hidden') void this.flush(); };
    const timer = setInterval(flush, 60000);
    target.addEventListener('online', flush);
    target.document?.addEventListener('visibilitychange', flush);
    flush();
    return () => {
      clearInterval(timer); target.removeEventListener('online', flush);
      target.document?.removeEventListener('visibilitychange', flush);
      if (activeService === this) activeService = null;
    };
  }
}
