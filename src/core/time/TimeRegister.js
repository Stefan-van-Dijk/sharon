import { IdentifierService } from '../ids/IdentifierService.js?v=0.5.25';

const namespace = /^[a-z][a-z0-9-]{0,39}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timestampPattern = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function objectReference(value) {
  const { source, id, class: objectClass } = value ?? {};
  if (typeof id !== 'string' || !IdentifierService.isValid(id) ||
      typeof source !== 'string' || !namespace.test(source) ||
      typeof objectClass !== 'string' || !namespace.test(objectClass)) {
    throw new Error('Kies een geldige bron, ID12 en klasse.');
  }
  return { source, id, class: objectClass };
}

export function referenceKey(value) {
  const { source, id } = objectReference(value);
  return source + ':' + id;
}

function calendarDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value) || value.startsWith('0000')) {
    throw new Error('Vul een geldige kalenderdatum in.');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Vul een geldige kalenderdatum in.');
  }
  return value;
}

function timestamp(value) {
  const match = typeof value === 'string' && timestampPattern.exec(value);
  if (!match || value.endsWith('-00:00')) throw new Error('Vul een tijdstip met bekende UTC-offset in.');
  calendarDate(match[1]);
  const utc = new Date(value).toISOString();
  calendarDate(utc.slice(0, 10));
  return utc;
}

export function temporalExtent(value) {
  const { kind } = value ?? {};
  if (kind === 'instant') return { kind, at: timestamp(value.at) };
  if (kind === 'interval') {
    const start = timestamp(value.start);
    const end = timestamp(value.end);
    if (start >= end) throw new Error('De eindtijd moet na de begintijd liggen.');
    return { kind, start, end };
  }
  if (kind === 'date-range') {
    const start = calendarDate(value.start);
    const end = calendarDate(value.end);
    if (start > end) throw new Error('De einddatum moet op of na de begindatum vallen.');
    return { kind, start, end };
  }
  throw new Error('Kies een tijdstip, tijdvak of periode in dagen.');
}

export const timeStart = value => value.at ?? value.start;

export class TimeRegister {
  #store;

  constructor(store) {
    this.#store = store;
  }

  async create(target, extent) {
    const data = { target: objectReference(target), extent: temporalExtent(extent) };
    const id = IdentifierService.create();
    const now = Date.now();
    const entry = {
      id, externalId: id, type: 'time-entry', class: 'time-entry', schemaVersion: 1,
      createdAt: now, updatedAt: now, data
    };
    await this.#store.addTimeEntry(entry);
    return entry;
  }

  async list(target = null) {
    const key = target && referenceKey(target);
    const records = await this.#store.getAll('objects');
    return records.filter(record => record.type === 'time-entry' && !record.deletedAt &&
      (!key || referenceKey(record.data.target) === key))
      .sort((left, right) => {
        const a = timeStart(left.data.extent);
        const b = timeStart(right.data.extent);
        return a < b ? -1 : a > b ? 1 : left.createdAt - right.createdAt;
      });
  }

  remove(id) {
    return this.#store.removeTimeEntry(IdentifierService.assert(id));
  }
}
