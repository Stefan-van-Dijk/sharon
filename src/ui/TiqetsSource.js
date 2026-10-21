import { saveTicketReference } from '../core/cards/TicketReferenceService.js?v=0.3.74';

// Live Tiqets source. No IndexedDB/localStorage, user identifiers or API tokens.
export const TIQETS_ENDPOINT = 'https://sharon.life/sources/tiqets.php';

export function tiqetsLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)*tiqets\.com$/i.test(url.hostname) ||
        url.username || url.password || url.port || !url.searchParams.get('partner')) return '';
    return url.href;
  } catch { return ''; }
}
export function tiqetsImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'cdn.tiqets.com' &&
      !url.username && !url.password && !url.port ? url.href : '';
  } catch { return ''; }
}
const text = value => typeof value === 'string' ? value.slice(0, 8000) : '';
const point = value => value && typeof value.lat === 'number' && typeof value.lng === 'number' &&
  Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
  Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180 ? [value.lng, value.lat] : null;

export function tiqetsFeatures(products) {
  const groups = new Map();
  for (const product of (Array.isArray(products) ? products : []).slice(0, 100)) {
    const coordinates = point(product.geolocation);
    const url = tiqetsLink(product.product_url);
    if (!coordinates || !url || !/^\d+$/.test(String(product.id)) ||
        !text(product.title) || product.sale_status !== 'available') continue;
    const images = (Array.isArray(product.images) ? product.images : []).map(image => ({
      url: tiqetsImage(image.large || image.medium || image.small),
      credit: text(image.credit), alt: text(image.alt_text)
    })).filter(image => image.url);
    const item = {
      id: String(product.id), title: text(product.title), url, images,
      summary: text(product.summary || product.tagline),
      included: text(product.whats_included),
      address: text(product.venue?.address), city: text(product.city_name)
    };
    const venueId = /^\d+$/.test(String(product.venue?.id)) ? String(product.venue.id) : '';
    const key = venueId ? 'venue-' + venueId : 'product-' + item.id;
    if (!groups.has(key)) groups.set(key, {
      type: 'Feature', id: 'tiqets-' + key, geometry: {type:'Point', coordinates},
      properties: {source:'tiqets', title:text(product.venue?.name) || item.title,
        description:item.summary, image:images[0]?.url || '', url, placeId:key, products:[]}
    });
    const feature = groups.get(key);
    if (!feature.properties.products.some(existing => existing.id === item.id)) feature.properties.products.push(item);
  }
  return {type:'FeatureCollection', features:[...groups.values()]};
}
export function tiqetsBoard(feature, {store, events} = {}) {
  const products = feature.properties.products;
  return {
    label:'Tiqets', badge:'T', url:products[0]?.url || '', resolveImage:tiqetsImage,
    onSave: store ? async index => {
      const product = products[index];
      if (!product) throw Error('Geen ticketoptie geselecteerd.');
      const [lng,lat] = feature.geometry.coordinates;
      const saved = await saveTicketReference(store, {
        provider:'tiqets',label:'Tiqets',productId:product.id,
        placeId:feature.properties.placeId,title:product.title,placeTitle:feature.properties.title,
        url:product.url,coordinates:{lat,lng},address:product.address
      });
      events?.emit?.('environment.objects.changed');
      return saved;
    } : null,
    sections:products.map(product => ({
      title:product.title, text:[product.summary, product.address, product.city,
        product.included ? 'Inbegrepen\n' + product.included : '',
        'Bekijk actuele tickets en beschikbaarheid via Tiqets.'].filter(Boolean).join('\n\n'),
      image:product.images[0]?.url || '', imageCredit:product.images[0]?.credit || '',
      imageAlt:product.images[0]?.alt || '', url:product.url
    }))
  };
}
export async function tiqetsStatus({fetcher = fetch, signal} = {}) {
  const response = await fetcher(TIQETS_ENDPOINT, {signal, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer'});
  if (!response.ok) return false;
  const data = await response.json();
  return data.configured === true;
}
export async function fetchTiqetsPlaces(center, {fetcher = fetch, signal, language = 'nl'} = {}) {
  if (!point(center)) throw Error('Geen geldige kaartpositie.');
  const response = await fetcher(TIQETS_ENDPOINT, {
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
    referrerPolicy:'no-referrer', cache:'no-store', signal,
    body:JSON.stringify({lat:center.lat, lng:center.lng,
      lang:/^[a-z]{2}$/.test(language) ? language : 'nl'})
  });
  if (!response.ok) {
    const error = Error(response.status === 503 ? 'Tiqets is nog niet beschikbaar.' : 'Tiqets is tijdelijk niet bereikbaar.');
    error.code = response.status;
    throw error;
  }
  const data = await response.json();
  if (data.source !== 'tiqets' || !Array.isArray(data.products)) throw Error('Ongeldig antwoord van Tiqets.');
  return tiqetsFeatures(data.products);
}
