import {AccountService} from '../connection/AccountService.js?v=0.5.30';
import { objectReference, referenceKey, temporalExtent } from '../time/TimeRegister.js?v=0.5.30';

export const EVENT_LINE_URL = 'https://sharon.life/eventline/';
const { origin, pathname } = new URL(EVENT_LINE_URL);
const publicPath = pathname + 'openbaar.html';
const selectorPattern = /^[a-f0-9]{32}:[a-f0-9]{32}$/;
const bookmarkKey = 'agenda.event-line.bookmarks.v1';

const connectionKey = 'agenda.event-line.connected.v1';

export async function eventLineConnected(store, accounts = new AccountService(store)) {
  try { await accounts.require(); } catch { return false; }
  const saved = await store.get('meta', connectionKey);
  return saved ? saved.value === true : Boolean((await store.get('meta', bookmarkKey))?.value?.length);
}

export function setEventLineConnected(store, value) {
  return store.put('meta', {key:connectionKey,value});
}

export function eventLineSelector(value) {
  const link = new URL(value);
  const selectors = link.searchParams.getAll('event');
  if (link.origin !== origin || link.username || link.password || link.pathname !== publicPath ||
      selectors.length !== 1 || !selectorPattern.test(selectors[0])) {
    throw new Error('Gebruik een openbare evenementlink van Event Line.');
  }
  return selectors[0];
}

export function eventLineLink(selector) {
  if (!selectorPattern.test(selector)) throw new Error('Ongeldige evenementverwijzing.');
  const link = new URL(publicPath, origin);
  link.searchParams.set('event', selector);
  return link.href;
}

export class EventLineSource {
  constructor(store, request = (...args) => fetch(...args)) {
    this.store = store;
    this.request = request;
  }

  async read(selector) {
    eventLineLink(selector);
    const endpoint = new URL('api/index.php', EVENT_LINE_URL);
    endpoint.searchParams.set('publicEvent', selector);
    const response = await this.request(endpoint, {
      credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    if (response.status === 404) throw new Error('Dit evenement is niet meer openbaar.');
    if (!response.ok) throw new Error('Event Line kon het evenement niet ophalen.');
    const { event } = await response.json();
    const ref = objectReference(event?.ref);
    if (ref.source !== 'event-line' || ref.class !== 'event' ||
        typeof event.title !== 'string' || typeof event.location !== 'string') {
      throw new Error('Ongeldig evenement uit Event Line.');
    }
    return { ref, title: event.title, location: event.location, time: temporalExtent(event.time) };
  }

  async list() {
    return (await this.store.get('meta', bookmarkKey))?.value ?? [];
  }

  async add(link) {
    const selector = eventLineSelector(link);
    const event = await this.read(selector);
    const key = referenceKey(event.ref);
    await this.store.updateMeta(bookmarkKey, (saved = []) =>
      saved.some(item => referenceKey(item.ref) === key) ? saved :
        [...saved, { ref: event.ref, selector, connections: [] }]);
  }

  connect(ref, connections) {
    const key = referenceKey(ref);
    const refs = [...new Map(connections.map(value => [referenceKey(value), objectReference(value)])).values()];
    return this.store.updateMeta(bookmarkKey, (saved = []) => saved.map(item =>
      referenceKey(item.ref) === key ? { ...item, connections: refs } : item));
  }

  remove(ref) {
    const key = referenceKey(ref);
    return this.store.updateMeta(bookmarkKey, (saved = []) =>
      saved.filter(item => referenceKey(item.ref) !== key));
  }

  async resolve(bookmark) {
    const event = await this.read(bookmark.selector);
    if (referenceKey(event.ref) !== referenceKey(bookmark.ref)) {
      throw new Error('De link verwijst naar een ander evenement.');
    }
    return event;
  }
}
