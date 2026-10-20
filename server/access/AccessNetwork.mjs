import { IdentifierService } from '../../src/core/ids/IdentifierService.js';

// Server-side domain policy. Authentication and atomic persistence are mandatory
// at the calling boundary; importing this module does not enable remote access.
export const ACCESS_LIMITS = Object.freeze({ members: 100, depth: 3 });

export function createAccessNetwork({ id = IdentifierService.create(), ownerId }) {
  IdentifierService.assert(id);
  IdentifierService.assert(ownerId);
  return { id, type: 'access-network', ownerId, members: [] };
}

function validate(network) {
  IdentifierService.assert(network?.id);
  IdentifierService.assert(network?.ownerId);
  if (network.type !== 'access-network' || !Array.isArray(network.members) ||
      network.members.length > ACCESS_LIMITS.members) throw Error('Ongeldig toegangsnetwerk.');
  const people = new Set([network.ownerId]);
  const records = new Set();
  for (const member of network.members) {
    IdentifierService.assert(member.id);
    IdentifierService.assert(member.personId);
    IdentifierService.assert(member.invitedBy);
    if (people.has(member.personId) || records.has(member.id) ||
        !['active', 'revoked'].includes(member.status)) throw Error('Ongeldige deelname.');
    people.add(member.personId);
    records.add(member.id);
  }
  // Every path must terminate at the owner, within three invitation edges.
  for (const member of network.members) lineOf(network, member.personId);
  return network;
}

export function lineOf(network, personId) {
  IdentifierService.assert(personId);
  const visited = new Set();
  let current = personId;
  let line = 0;
  while (current !== network.ownerId) {
    if (visited.has(current)) throw Error('Cyclische uitnodigingsrelatie.');
    visited.add(current);
    const member = network.members.find(item => item.personId === current);
    if (!member) throw Error('Persoon hoort niet bij dit netwerk.');
    current = member.invitedBy;
    if (++line > ACCESS_LIMITS.depth) throw Error('Maximaal drie uitnodigingslijnen.');
  }
  return line;
}

export function hasNetworkAccess(network, personId) {
  validate(network);
  return personId === network.ownerId ||
    network.members.some(item => item.personId === personId && item.status === 'active');
}

// inviterId MUST come from a validated, recipient-bound invitation issued by
// the server; personId MUST come from the authenticated accepting identity.
// A repeated acceptance returns the original membership and never reparents it.
export function acceptInvitation(network, { personId, inviterId, membershipId = IdentifierService.create() }) {
  validate(network);
  IdentifierService.assert(personId);
  IdentifierService.assert(inviterId);
  if (!hasNetworkAccess(network, inviterId)) throw Error('Uitnodiger heeft geen toegang.');
  if (personId === network.ownerId) return network;
  const existing = network.members.find(item => item.personId === personId);
  if (existing) {
    if (existing.status === 'revoked') throw Error('Toegang is ingetrokken; herstel door eigenaar vereist.');
    return network;
  }
  if (lineOf(network, inviterId) >= ACCESS_LIMITS.depth) throw Error('Maximaal drie uitnodigingslijnen.');
  // Revoked identities keep their original place: this is the first 100 unique
  // people ever accepted, not a pool of 100 simultaneously active accounts.
  if (network.members.length >= ACCESS_LIMITS.members) throw Error('De eerste 100 plaatsen zijn bezet.');
  IdentifierService.assert(membershipId);
  if (network.members.some(item => item.id === membershipId)) throw Error('Deelname-ID bestaat al.');
  return {
    ...network,
    members: [...network.members, {
      id: membershipId, personId, invitedBy: inviterId, status: 'active'
    }]
  };
}

export function setMemberAccess(network, { actorId, personId, status }) {
  validate(network);
  if (actorId !== network.ownerId) throw Error('Alleen de eigenaar mag toegang wijzigen.');
  if (!['active', 'revoked'].includes(status)) throw Error('Ongeldige toegangsstatus.');
  if (!network.members.some(item => item.personId === personId)) throw Error('Deelnemer bestaat niet.');
  return {
    ...network,
    members: network.members.map(item => item.personId === personId ? { ...item, status } : item)
  };
}

// An adapter must lock this network, invoke change once against the latest
// committed snapshot, durably commit, then resolve. Never implement with a
// separate read()/write() pair or with a browser-local counter.
export async function acceptInvitationAtomically({
  transact, networkId, authenticatedPersonId, verifiedInvitation
}) {
  IdentifierService.assert(networkId);
  IdentifierService.assert(authenticatedPersonId);
  if (typeof transact !== 'function' ||
      verifiedInvitation?.networkId !== networkId ||
      verifiedInvitation?.recipientId !== authenticatedPersonId) {
    throw Error('Een geverifieerde uitnodiging en centrale transactie zijn verplicht.');
  }
  IdentifierService.assert(verifiedInvitation.inviterId);
  const membershipId = IdentifierService.create();
  return transact(networkId, network => {
    if (network?.id !== networkId) throw Error('Verkeerd toegangsnetwerk.');
    return acceptInvitation(network, {
      personId: authenticatedPersonId,
      inviterId: verifiedInvitation.inviterId,
      membershipId
    });
  });
}
