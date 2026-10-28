import { IdentifierService } from '../ids/IdentifierService.js?v=0.4.19';

// Only an explicit save creates personal objects. Never turn an offer URL into
// a scannable admission code, and never replace a ticket already enriched by its owner.
const queues = new WeakMap();
export function saveTicketReference(store, reference) {
  const previous = queues.get(store) || Promise.resolve();
  const result = previous.catch(() => {}).then(() => save(store, reference));
  queues.set(store, result);
  return result;
}
async function save(store, reference) {
  const {provider, productId, placeId, title, placeTitle, url, coordinates, address = ''} = reference;
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Geen geldige bronlink.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      !provider || !productId || !String(title || '').trim()) throw Error('Onvolledige ticketverwijzing.');
  const objects = await store.getAll('objects');
  const existing = objects.find(item => item.type === 'card' && !item.deletedAt &&
    !item.archivedAt && item.status !== 'archived' &&
    item.reference?.provider === provider && item.reference?.productId === productId);
  if (existing) return existing;
  const now = new Date().toISOString();
  let locationId = null;
  if (placeId && coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number' &&
      Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng) &&
      Math.abs(coordinates.lat) <= 90 && Math.abs(coordinates.lng) <= 180) {
    let place = objects.find(item => item.type === 'location' && !item.deletedAt && !item.archivedAt &&
      item.data?.source?.provider === provider && item.data.source.placeId === placeId);
    if (!place) {
      place = {id:IdentifierService.create(),type:'location',schemaVersion:1,createdAt:now,updatedAt:now,
        data:{title:String(placeTitle || title).slice(0,100),locationType:'other',coordinates:{...coordinates},
          address:{text:String(address).slice(0,1000)},source:{provider,placeId}}};
      // The stable provider/place mapping lets a retry reuse this location if
      // the later card write fails; no unrelated existing data is overwritten.
      await store.put('objects',place);
    }
    locationId = place.id;
  }
  const card = {
    id:IdentifierService.create(),type:'card',cardKind:'ticket',name:String(title).slice(0,100),
    color:'#008b88',codeFormat:'',codeValue:'',cardNumber:'',locationId,
    fields:[],reference:{provider,productId,label:reference.label || provider,url:parsed.href},
    createdAt:now,updatedAt:now
  };
  await store.put('objects',card);
  return card;
}
