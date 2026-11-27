const idFields = ['locationId', 'parentId', 'sharedObjectId'];
const idLists = ['personIds', 'sharedRelatedIds'];
export const agendaLinksKey = 'agenda.event-line.bookmarks.v1';

function hasIds(fields) {
  return idFields.some(key => Boolean(fields?.[key])) ||
    idLists.some(key => Array.isArray(fields?.[key]) && fields[key].length);
}

function disconnect(fields, id) {
  if (!fields) return fields;
  const changes = {};
  for (const key of idFields) if (fields[key] === id) changes[key] = null;
  for (const key of idLists) {
    if (Array.isArray(fields[key]) && fields[key].includes(id)) changes[key] = fields[key].filter(value => value !== id);
  }
  return Object.keys(changes).length ? {...fields, ...changes} : fields;
}

function matches(ref, item) {
  return ref?.source === 'sharon' && ref.class === item.type &&
    (ref.id === item.id || ref.id === item.externalId);
}

export function objectRelationChanges(item, records, bookmarks = []) {
  const updates = [], remove = [];
  for (const record of records) {
    if (record.id === item.id || record.deletedAt) continue;
    if ((record.type === 'time-entry' && matches(record.data?.target, item)) ||
        (record.type === 'location-action' && record.data?.locationId === item.id)) {
      remove.push(record.id);
      continue;
    }
    const row = disconnect(record, item.id);
    const data = disconnect(record.data, item.id);
    if (row !== record || data !== record.data) updates.push({...row, ...(data !== undefined ? {data} : {})});
  }
  const nextBookmarks = bookmarks.map(entry => {
    const connections = entry.connections?.filter(ref => !matches(ref, item));
    return connections?.length === entry.connections?.length ? entry : {...entry, connections};
  });
  const agendaChanged = nextBookmarks.some((entry, index) => entry !== bookmarks[index]);
  return {
    linked: hasIds(item) || hasIds(item.data) || !!(updates.length || remove.length || agendaChanged),
    updates, remove, bookmarks: agendaChanged ? nextBookmarks : null
  };
}
