import { demoWorkspace, saveDemoDataset } from './SkeletonCore.js?v=0.3.58';

// Adapt the regular location editor to the existing test graph. All writes stay
// in test metadata; IDs, graph links and edits made in other test modules survive.
export function createDemoLocationStore(store) {
  const prefix = 'skeleton.locations.';
  let pending = Promise.resolve();
  const load = async () => {
    const workspace = await demoWorkspace(store);
    if (!workspace.enabled) throw Error('De testomgeving is niet actief.');
    return workspace.data;
  };
  const records = data => [
    ...data.objects.filter(item => item.module === 'locations').map(item => ({
      ...(item.fields?.locationRecord || {}),
      id: item.id, externalId: item.id, type: 'location', schemaVersion: 1,
      deletedAt: item.status === 'archived' ? (item.fields?.locationRecord?.deletedAt || 1) : null,
      data: {
        kind: item.fields?.type === 'winkel' ? 'shop' : 'other', radiusM: 100,
        ...item.fields?.locationRecord?.data, title: item.title
      }
    })),
    ...(data.locationActions || [])
  ];
  const write = work => {
    const result = pending.then(work);
    pending = result.catch(() => {});
    return result;
  };
  return {
    async getAll(table) {
      await pending;
      if (table !== 'objects') throw Error('Deze testopslag ondersteunt alleen locaties.');
      return structuredClone(records(await load()));
    },
    async get(table, key) {
      await pending;
      if (table === 'objects') return records(await load()).find(item => item.id === key);
      if (!['meta', 'settings'].includes(table)) throw Error('Onbekende testopslag.');
      const record = await store.get('meta', prefix + table + '.' + key);
      return record ? { ...record, key } : undefined;
    },
    put(table, value) {
      return write(async () => {
        const data = await load();
        if (table === 'objects') {
          if (value.type === 'location') {
            const existing = data.objects.find(item => item.id === value.id);
            if (existing && existing.module !== 'locations') throw Error('Dit ID hoort bij een ander testobject.');
            const object = {
              ...existing, id: value.id, module: 'locations', title: value.data?.title || 'Locatie',
              status: value.deletedAt ? 'archived' : 'active',
              fields: { ...existing?.fields, locationRecord: structuredClone(value) }
            };
            if (existing) data.objects[data.objects.indexOf(existing)] = object;
            else data.objects.push(object);
            const target = value.data?.mergedInto;
            if (target) {
              data.relations = data.relations.map(relation => ({
                ...relation, from: relation.from === value.id ? target : relation.from,
                to: relation.to === value.id ? target : relation.to
              })).filter(relation => relation.from !== relation.to);
            }
          } else if (value.type === 'location-action') {
            data.locationActions = [...(data.locationActions || []).filter(item => item.id !== value.id), structuredClone(value)];
          } else throw Error('Alleen testlocaties en locatieacties kunnen worden opgeslagen.');
          await saveDemoDataset(store, data);
          return value.id;
        }
        if (!['meta', 'settings'].includes(table)) throw Error('Onbekende testopslag.');
        return store.put('meta', { ...value, key: prefix + table + '.' + value.key });
      });
    }
  };
}
