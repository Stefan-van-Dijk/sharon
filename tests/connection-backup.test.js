import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ObjectStore } from '../src/core/storage/ObjectStore.js';
import { ConnectionService } from '../src/core/connection/ConnectionService.js';
import { decryptConnectionBackup } from '../src/core/connection/ConnectionBackup.js';

test('Encrypted backup restores the same server identity on a clean installation', async () => {
  globalThis.indexedDB = new IDBFactory();
  const first = await new ObjectStore().open();
  const original = new ConnectionService(first);
  const device = await original.device();
  const self = { personId: device.personId, networkId: 'ABCDEFGHIJKL', line: 1 };
  await original.rememberSelf(self);
  const password = 'een aparte, lange testwachtzin';
  const backup = await original.exportBackup(password);
  assert(!backup.includes(device.personId));
  assert(!backup.includes(device.deviceToken));
  await assert.rejects(decryptConnectionBackup(backup, 'een onjuiste testwachtzin'), /wachtzin klopt niet/);

  globalThis.indexedDB = new IDBFactory();
  const clean = await new ObjectStore().open();
  let response = { ...self, personId: 'abcdefghijkl' };
  let calls = 0;
  const restored = new ConnectionService(clean, {fetcher:async (_url, options) => {
    assert.equal(options.headers['X-Log-Access-Token'], device.deviceToken);
    assert.equal(JSON.parse(options.body).action, 'self');
    calls++;
    return {ok:true,json:async () => ({self:response})};
  }});
  await assert.rejects(restored.restoreBackup(backup, password), /andere identiteit/);
  assert.deepEqual(await clean.getAll('meta'), []);
  response = self;
  await restored.restoreBackup(backup, password);
  assert.deepEqual(await restored.device(), {...device, registered:true, self});

  globalThis.indexedDB = new IDBFactory();
  const existingStore = await new ObjectStore().open();
  const existing = new ConnectionService(existingStore, {fetcher:async () => { calls++; }});
  const previous = await existing.device();
  await assert.rejects(existing.restoreBackup(backup, password), /al een andere Sharon-ID/);
  assert.deepEqual(await existing.device(), previous);
  assert.equal(calls, 2);
});
