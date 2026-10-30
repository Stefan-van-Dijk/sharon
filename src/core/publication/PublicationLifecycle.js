import { IdentifierService } from '../ids/IdentifierService.js?v=0.4.34';

export const PUBLICATION_STATUS = Object.freeze({
  LOCAL: 'local', ONLINE: 'online', OFFLINE: 'offline', DELETED: 'deleted'
});

const allowed = new Set(Object.values(PUBLICATION_STATUS));

export function createPublication({ objectId, objectType, externalId = IdentifierService.create(), now = new Date().toISOString() }) {
  if (!objectId || !objectType) throw new Error('Een lokaal object en type zijn verplicht.');
  IdentifierService.assert(externalId);
  return { objectId, objectType, externalId, status: PUBLICATION_STATUS.LOCAL,
    revision: 0, createdAt: now, updatedAt: now };
}

export function transitionPublication(publication, action, { now = new Date().toISOString() } = {}) {
  if (!publication || !allowed.has(publication.status)) throw new Error('Ongeldige publicatie.');
  const next = { ...publication, updatedAt: now };
  if (action === 'publish' && [PUBLICATION_STATUS.LOCAL, PUBLICATION_STATUS.OFFLINE].includes(next.status)) {
    next.status = PUBLICATION_STATUS.ONLINE;
    next.revision += 1;
  } else if (action === 'offline' && next.status === PUBLICATION_STATUS.ONLINE) {
    next.status = PUBLICATION_STATUS.OFFLINE;
  } else if (action === 'delete' && next.status !== PUBLICATION_STATUS.DELETED) {
    next.status = PUBLICATION_STATUS.DELETED;
  } else {
    throw new Error('Deze publicatieovergang is niet toegestaan.');
  }
  return next;
}

/**
 * A transition is only persisted after the authenticated server confirms the
 * corresponding file operation. Never mark an offline publication as removed
 * merely because the network request was started.
 */
export async function applyPublicationAction(publication, action, { perform, save, now } = {}) {
  if (typeof perform !== 'function' || typeof save !== 'function') {
    throw new Error('Een serveractie en lokale opslag zijn verplicht.');
  }
  const next = transitionPublication(publication, action, { now });
  await perform({ action, externalId: publication.externalId, revision: next.revision });
  await save(next);
  return next;
}
