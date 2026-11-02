import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { ObjectStore } from '../src/core/storage/ObjectStore.js';

test('put en delete wachten op transactiecommit', async () => {
  const db = await new ObjectStore().open();
  const id = 'commit-check-' + Math.random().toString(36).slice(2);
  await db.put('objects', { id, type: 'test', data: { value: 1 } });
  assert.equal((await db.get('objects', id)).data.value, 1);
  await db.delete('objects', id);
  assert.equal(await db.get('objects', id), undefined);
});

test('afgebroken transactie meldt geen schijnsucces en schrijft niets', async () => {
  const db = await new ObjectStore().open();
  const id = 'abort-check-' + Math.random().toString(36).slice(2);
  // Re-use the existing object key to provoke an index/storage failure inside
  // the transaction through a DataCloneError (a function cannot be cloned).
  await assert.rejects(db.put('objects', {
    id, type: 'test', data: { invalid: () => true }
  }));
  assert.equal(await db.get('objects', id), undefined);
});
