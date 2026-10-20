import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccessNetwork, acceptInvitation, lineOf, hasNetworkAccess,
  setMemberAccess, acceptInvitationAtomically
} from '../server/access/AccessNetwork.mjs';

const id = n => String(n).padStart(12, '0');
const ownerId = id(1);
const networkId = id(2);
const fresh = () => createAccessNetwork({ id: networkId, ownerId });
const join = (network, n, inviterId = ownerId) => acceptInvitation(network, {
  personId: id(n), inviterId, membershipId: id(1000 + n)
});

test('three invitation lines, stable identities and immutable membership records', () => {
  const original = fresh();
  let network = join(original, 10);
  network = join(network, 11, id(10));
  network = join(network, 12, id(11));
  assert.deepEqual([ownerId, id(10), id(11), id(12)].map(p => lineOf(network, p)), [0, 1, 2, 3]);
  assert.throws(() => join(network, 13, id(12)), /drie/);
  assert.equal(original.members.length, 0);
  const repeated = join(network, 12);
  assert.equal(repeated, network);
  assert.equal(repeated.members[2].invitedBy, id(11));
  assert.equal(repeated.members[2].id, id(1012));
  assert.equal(join(network, 1), network);
});

test('first 100 unique people, owner excluded and duplicates do not consume places', () => {
  let network = fresh();
  for (let n = 10; n < 110; n++) network = join(network, n);
  assert.equal(network.members.length, 100);
  assert.equal(join(network, 10), network);
  assert.throws(() => join(network, 110), /100/);
  network = setMemberAccess(network, { actorId: ownerId, personId: id(10), status: 'revoked' });
  assert.throws(() => join(network, 110), /100/);
});

test('revocation preserves invitation paths and needs owner restoration', () => {
  let network = join(join(fresh(), 10), 11, id(10));
  const record = network.members[0];
  network = setMemberAccess(network, { actorId: ownerId, personId: id(10), status: 'revoked' });
  assert.equal(hasNetworkAccess(network, id(10)), false);
  assert.equal(hasNetworkAccess(network, id(11)), true);
  assert.equal(lineOf(network, id(11)), 2);
  assert.throws(() => join(network, 12, id(10)), /geen toegang/);
  assert.throws(() => join(network, 10), /herstel/);
  assert.throws(() => setMemberAccess(network, { actorId: id(11), personId: id(10), status: 'active' }), /eigenaar/);
  network = setMemberAccess(network, { actorId: ownerId, personId: id(10), status: 'active' });
  assert.deepEqual(network.members[0], record);
});

test('reject unknown inviters, invalid identifiers, duplicate record IDs and corrupt paths', () => {
  assert.throws(() => createAccessNetwork({ ownerId: 'bad' }));
  assert.throws(() => join(fresh(), 10, id(99)), /geen toegang/);
  let network = join(fresh(), 10);
  assert.throws(() => acceptInvitation(network, { personId: id(11), inviterId: ownerId, membershipId: id(1010) }), /bestaat/);
  const cyclic = { ...network, members: [{ ...network.members[0], invitedBy: id(10) }] };
  assert.throws(() => join(cyclic, 11), /Cyclische/);
  const orphan = { ...network, members: [{ ...network.members[0], invitedBy: id(99) }] };
  assert.throws(() => join(orphan, 11), /hoort niet/);
});

test('central adapter serializes competing claims for the last place', async () => {
  let stored = fresh();
  for (let n = 10; n < 109; n++) stored = join(stored, n);
  let queue = Promise.resolve();
  const transact = (key, change) => {
    assert.equal(key, networkId);
    const result = queue.then(() => {
      const next = change(structuredClone(stored));
      stored = structuredClone(next);
      return next;
    });
    queue = result.catch(() => {});
    return result;
  };
  const accept = n => acceptInvitationAtomically({
    transact, networkId, authenticatedPersonId: id(n),
    verifiedInvitation: { networkId, recipientId: id(n), inviterId: ownerId }
  });
  const results = await Promise.allSettled([accept(109), accept(110)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(stored.members.length, 100);
  const accepted = results.find(r => r.status === 'fulfilled').value;
  assert.deepEqual(stored, accepted);
});

test('mismatched invitation cannot reach persistence', async () => {
  let called = false;
  await assert.rejects(acceptInvitationAtomically({
    transact: () => { called = true; }, networkId, authenticatedPersonId: id(10),
    verifiedInvitation: { networkId, recipientId: id(11), inviterId: ownerId }
  }), /geverifieerde/);
  assert.equal(called, false);
});

test('failed persistence never mutates the original network', async () => {
  const network = fresh();
  await assert.rejects(acceptInvitationAtomically({
    networkId, authenticatedPersonId: id(10),
    verifiedInvitation: { networkId, recipientId: id(10), inviterId: ownerId },
    transact: async (key, change) => { change(network); throw Error('storage unavailable'); }
  }), /storage/);
  assert.deepEqual(network, fresh());
});
