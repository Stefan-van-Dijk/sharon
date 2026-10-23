// A source namespace and its stable identifier define an item, not its display URL.
export function informationReference(value) {
  const {source, id} = value || {};
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(source || '') || typeof id !== 'string' ||
      !id.length || id.length > 200 || id.trim() !== id || /[\x00-\x1f\x7f]/.test(id)) throw Error('Ongeldige informatiebron.');
  if (source === 'wikipedia' && !/^Q[1-9][0-9]*$/.test(id)) throw Error('Ongeldig Wikipedia-onderwerp.');
  const uri = source === 'wikipedia' ? 'https://www.wikidata.org/entity/' + id : String(value.uri || '');
  const url = new URL(uri);
  if (uri.length > 2048 || url.protocol !== 'https:' || url.username || url.password) throw Error('Ongeldige bron-URI.');
  return {source, id, uri};
}
export function informationKey(reference) {
  const item = informationReference(reference);
  return item.source + ':' + encodeURIComponent(item.id);
}
export function wikipediaReference(feature) {
  return informationReference({source:'wikipedia', id:String(feature?.properties?.wikidata || feature?.id || '')});
}
export const emptyFeedback = () => ({opened:false, read:false, liked:false, disliked:false});
export function feedbackState(value = {}) {
  const state = Object.fromEntries(Object.keys(emptyFeedback()).map(key => [key, value[key] === true]));
  if (state.liked) state.disliked = false;
  return state;
}
export function distanceMeters(a, b) {
  if (!a || !b || ![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite)) return null;
  const rad = Math.PI / 180, dlat = (b.lat-a.lat)*rad, dlon = (b.lng-a.lng)*rad;
  const h = Math.sin(dlat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
// Popularity changes ordering inside an editorial boundary; it never expands it.
export function informationRank(summary = {}, distance = null, mode = 'relevant') {
  const policy = summary.policy || {baseRadius:10000, maxRadius:10000, weight:0.5};
  const radius = Math.min(policy.baseRadius, policy.maxRadius);
  if (mode === 'nearby') return distance === null ? 0 : -distance;
  if (distance !== null && distance > radius) return -Infinity;
  const counts = summary.counts || {};
  const voters = (counts.liked || 0) + (counts.disliked || 0);
  const popularity = ((counts.liked || 0) - (counts.disliked || 0)) / (Math.max(counts.opened || 0, counts.read || 0, voters) + 3);
  if (mode === 'popular') return popularity;
  return policy.weight + popularity + (distance === null ? 0 : 1 - distance / Math.max(1, radius));
}
