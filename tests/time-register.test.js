import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { ObjectStore } from '../src/core/storage/ObjectStore.js';
import { referenceKey, temporalExtent, TimeRegister } from '../src/core/time/TimeRegister.js';

const id = 'Abcdef123456';
const note = { source: 'sharon', id, class: 'note' };

test('time extents preserve calendar dates and normalize explicit offsets', () => {
  assert.deepEqual(temporalExtent({
    kind: 'date-range', start: '2028-02-29', end: '2028-02-29'
  }), { kind: 'date-range', start: '2028-02-29', end: '2028-02-29' });
  assert.deepEqual(temporalExtent({
    kind: 'interval', start: '2026-10-25T02:30:00+02:00', end: '2026-10-25T02:30:00+01:00'
  }), { kind: 'interval', start: '2026-10-25T00:30:00.000Z', end: '2026-10-25T01:30:00.000Z' });
  for (const at of ['2026-02-29T09:00:00Z', '2026-10-25T02:30:00', '2026-10-25T02:30:00-00:00']) {
    assert.throws(() => temporalExtent({ kind: 'instant', at }));
  }
  assert.throws(() => temporalExtent({
    kind: 'interval', start: '2026-10-25T02:30:00+02:00', end: '2026-10-25T00:30:00Z'
  }));
});

test('source plus ID12 determines identity, and removing time preserves old records', async () => {
  const store = await new ObjectStore().open();
  const legacy = { id, type: 'note', name: 'Oude notitie', personIds: ['123456ABCDEF'] };
  await store.put('objects', legacy);
  const register = new TimeRegister(store);
  const event = { source: 'event-line', id, class: 'event' };
  assert.notEqual(referenceKey(note), referenceKey(event));
  assert.throws(() => referenceKey({ ...note, id: 'too-short' }));
  const extent = { kind: 'date-range', start: '2026-11-26', end: '2026-11-26' };
  const [local, external] = await Promise.all([register.create(note, extent), register.create(event, extent)]);
  assert.deepEqual((await register.list(note)).map(item => item.id), [local.id]);
  assert.deepEqual((await new TimeRegister(await new ObjectStore().open()).list(event)).map(item => item.id), [external.id]);
  await register.remove(id);
  await register.remove(local.id);
  await register.remove(local.id);
  assert.deepEqual(await store.get('objects', id), legacy);
  assert.deepEqual((await register.list()).map(item => item.id), [external.id]);
});
