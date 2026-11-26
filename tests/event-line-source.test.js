import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { ObjectStore } from '../src/core/storage/ObjectStore.js';
import { EventLineSource, eventLineLink, eventLineSelector } from '../src/core/events/EventLineSource.js';

const selector = 'a'.repeat(32) + ':' + 'b'.repeat(32);
const ref = { source: 'event-line', id: 'EventAbcd123', class: 'event' };

test('only the public Event Line URL can be bookmarked', () => {
  assert.equal(eventLineSelector(eventLineLink(selector)), selector);
  for (const url of [
    eventLineLink(selector).replace('sharon.life', 'example.com'),
    eventLineLink(selector).replace('https:', 'http:'),
    eventLineLink(selector) + '&event=' + selector,
    'https://sharon.life/eventlijn/api/index.php?event=' + selector
  ]) assert.throws(() => eventLineSelector(url));
});

test('Agenda stores references only and resolves current public event data without credentials', async () => {
  const store = await new ObjectStore().open();
  const event = {
    ref, title: 'Oorspronkelijke titel', location: 'Plaats', time: {
      kind: 'date-range', start: '2026-11-26', end: '2026-11-27'
    }
  };
  let isPublic = true;
  const source = new EventLineSource(store, async (url, options) => {
    assert.equal(url.origin, 'https://sharon.life');
    assert.equal(url.pathname, '/eventlijn/api/index.php');
    assert.equal(url.searchParams.get('publicEvent'), selector);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    return isPublic ? { ok: true, json: async () => ({ event }) } : { ok: false, status: 404 };
  });
  const link = eventLineLink(selector);
  await Promise.all([source.add(link), source.add(link)]);
  const note = { id: 'Agendanote12', source: 'sharon', class: 'note' };
  await source.connect(ref, [note, note]);
  await source.add(link);
  assert.deepEqual(await source.list(), [{ ref, selector, connections: [note] }]);
  const [bookmark] = await source.list();
  event.title = 'Bijgewerkte titel';
  assert.equal((await source.resolve(bookmark)).title, event.title);
  isPublic = false;
  await assert.rejects(source.resolve(bookmark), /niet meer openbaar/);
  await source.remove(ref);
  assert.deepEqual(await source.list(), []);
});
