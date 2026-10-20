import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublication, transitionPublication, applyPublicationAction } from '../src/core/publication/PublicationLifecycle.js';

const original = () => createPublication({ objectId: 'chat-1', objectType: 'chat', externalId: 'Abc123def456', now: '2026-10-20T00:00:00Z' });

test('offline and republish retain the exact identifier and increment revision', () => {
  const local = original();
  const online = transitionPublication(local, 'publish');
  const offline = transitionPublication(online, 'offline');
  const restored = transitionPublication(offline, 'publish');
  assert.equal(online.revision, 1);
  assert.equal(offline.status, 'offline');
  assert.equal(restored.externalId, local.externalId);
  assert.equal(restored.revision, 2);
  assert.equal(local.status, 'local');
});

test('deleted publications cannot be republished', () => {
  const deleted = transitionPublication(original(), 'delete');
  assert.throws(() => transitionPublication(deleted, 'publish'));
});

test('server failure does not persist a false publication status', async () => {
  let saved = false;
  await assert.rejects(applyPublicationAction(original(), 'publish', {
    perform: async () => { throw Error('server unavailable'); },
    save: async () => { saved = true; }
  }));
  assert.equal(saved, false);
});

test('successful server confirmation persists the new state', async () => {
  let saved;
  const result = await applyPublicationAction(original(), 'publish', {
    perform: async ({ externalId }) => assert.equal(externalId, 'Abc123def456'),
    save: async state => { saved = state; }
  });
  assert.deepEqual(saved, result);
});
