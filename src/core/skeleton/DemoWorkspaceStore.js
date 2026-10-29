import { IdentifierService } from '../ids/IdentifierService.js?v=0.4.28';
import { demoWorkspace, saveDemoDataset } from './SkeletonCore.js?v=0.4.28';

// One test workspace for the same production modules and context rules.
// Existing graph identifiers and legacy test metadata remain readable.
export function createDemoWorkspaceStore(store) {
  const prefix = 'skeleton.workspace.';
  let pending = Promise.resolve();
  const load = async () => {
    const workspace = await demoWorkspace(store);
    if (!workspace.enabled) throw Error('De testomgeving is niet actief.');
    return workspace.data;
  };
  const linkedPeople = (data,id) => data.relations.filter(r=>r.from===id||r.to===id)
    .map(r=>r.from===id?r.to:r.from).filter(id=>data.objects.some(o=>o.id===id&&o.module==='persons'));
  const records = data => [
    ...data.objects.filter(item=>item.module==='persons').map(item=>({id:item.id,type:'person',name:item.title,deletedAt:item.status==='archived'?1:null})),
    ...data.objects.filter(item => item.module === 'locations').map(item => ({
      ...(item.fields?.locationRecord || {}),
      id: item.id, externalId: item.id, type: 'location', schemaVersion: 1,
      deletedAt: item.status === 'archived' ? (item.fields?.locationRecord?.deletedAt || 1) : null,
      personIds: linkedPeople(data,item.id),
      data: {
        kind: item.fields?.type === 'winkel' ? 'shop' : 'other', radiusM: 100,
        ...item.fields?.locationRecord?.data, title: item.title
      }
    })),
    ...data.objects.filter(item => item.module === 'cards').map(item => ({
      ...(item.fields?.cardRecord || {}), id: item.id, type: 'card', name: item.title,
      personIds: linkedPeople(data,item.id),
      cardKind: item.fields?.cardRecord?.cardKind || 'loyalty',
      locationId: data.relations.find(relation => relation.from === item.id && relation.type === 'usable-at' &&
        data.objects.some(target => target.id === relation.to && target.module === 'locations'))?.to || null,
      deletedAt: item.status === 'archived' ? 1 : null
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
      if (table !== 'objects') throw Error('Deze testopslag ondersteunt alleen objecten.');
      return structuredClone(records(await load()));
    },
    async get(table, key) {
      await pending;
      if (table === 'objects') {
        const data = await load();
        return records(data).find(item => item.id === key) || data.objects.find(item => item.id === key);
      }
      if (!['meta', 'settings'].includes(table)) throw Error('Onbekende testopslag.');
      const record = await store.get('meta', prefix + table + '.' + key)
        || await store.get('meta', 'skeleton.locations.' + table + '.' + key)
        || (table === 'meta' ? await store.get('meta', 'skeleton.environment.' + key) : null);
      return record ? { ...record, key } : undefined;
    },
    delete(table, key) {
      return write(async () => {
        const data = await load();
        if (table === 'objects') {
          const object = data.objects.find(item => item.id === key);
          if (!object || !['cards', 'locations'].includes(object.module)) throw Error('Onbekend testobject.');
          if (data.relations.some(relation => relation.from === key || relation.to === key)) object.status = 'archived';
          else data.objects = data.objects.filter(item => item.id !== key);
          await saveDemoDataset(store, data);
          return;
        }
        if (!['meta', 'settings'].includes(table)) throw Error('Onbekende testopslag.');
        // Remove legacy fallbacks too, so reset cannot resurrect an old preference.
        await store.delete('meta', prefix + table + '.' + key);
        await store.delete('meta', 'skeleton.locations.' + table + '.' + key);
        if (table === 'meta') await store.delete('meta', 'skeleton.environment.' + key);
      });
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
          } else if (value.type === 'card') {
            const existing = data.objects.find(item => item.id === value.id);
            if (existing && existing.module !== 'cards') throw Error('Dit ID hoort bij een ander testobject.');
            const previous = records(data).find(item => item.id === value.id)?.locationId || null;
            const selected = value.locationId || null;
            if (selected && !data.objects.some(item => item.id === selected && item.module === 'locations' && item.status !== 'archived')) {
              throw Error('Kies een bestaande testlocatie.');
            }
            const object = { ...existing, id: value.id, module: 'cards', title: value.name,
              status: value.deletedAt ? 'archived' : 'active',
              fields: { ...existing?.fields, cardRecord: structuredClone(value) } };
            if (existing) data.objects[data.objects.indexOf(existing)] = object;
            else data.objects.push(object);
            if (previous !== selected) {
              data.relations = data.relations.filter(relation => !(relation.from === value.id && relation.type === 'usable-at'));
              if (selected) {
                let id;
                do { id = IdentifierService.create(); }
                while (data.relations.some(relation => relation.id === id));
                data.relations.push({ id, from: value.id, to: selected, type: 'usable-at' });
              }
            }
          } else if (value.type === 'location-action') {
            data.locationActions = [...(data.locationActions || []).filter(item => item.id !== value.id), structuredClone(value)];
          } else throw Error('Dit objecttype wordt nog niet ondersteund in de testomgeving.');
          if(['card','location'].includes(value.type) && Array.isArray(value.personIds)) {
            const isPerson=id=>data.objects.some(o=>o.id===id&&o.module==='persons');
            if(value.personIds.some(id=>!isPerson(id)))throw Error('Kies een bestaande testpersoon.');
            data.relations=data.relations.filter(r=>!((r.from===value.id&&isPerson(r.to)&&!value.personIds.includes(r.to))||(r.to===value.id&&isPerson(r.from)&&!value.personIds.includes(r.from))));
            for(const personId of new Set(value.personIds)) {
              if(data.relations.some(r=>(r.from===value.id&&r.to===personId)||(r.to===value.id&&r.from===personId)))continue;
              let id;do{id=IdentifierService.create();}while(data.relations.some(r=>r.id===id));
              data.relations.push({id,from:value.id,to:personId,type:'related-to'});
            }
          }
          await saveDemoDataset(store, data);
          return value.id;
        }
        if (!['meta', 'settings'].includes(table)) throw Error('Onbekende testopslag.');
        return store.put('meta', { ...value, key: prefix + table + '.' + value.key });
      });
    }
  };
}
