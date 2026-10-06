const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org';

export class ReverseGeocodeService {
  #endpoint;

  constructor({ endpoint = DEFAULT_ENDPOINT } = {}) {
    this.#endpoint = endpoint.replace(/\/$/, '');
  }

  async reverse({ lat, lng }) {
    const url = new URL(`${this.#endpoint}/reverse`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('layer', 'address');
    url.searchParams.set('accept-language', 'nl');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Adres kon niet worden opgehaald.');
    }

    const data = await response.json();
    return normalizeResult(data);
  }

  async search(query) {
    const value = String(query ?? '').trim();
    if (!value) return [];

    const url = new URL(`${this.#endpoint}/search`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', value);
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'nl');
    url.searchParams.set('accept-language', 'nl');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Plek kon niet worden gezocht.');
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data.map(normalizeResult).filter(Boolean)
      : [];
  }
}

function normalizeResult(data) {
  if (!data) return null;

  const address = data.address ?? {};
  const street =
    address.road ||
    address.pedestrian ||
    address.residential ||
    address.footway ||
    address.cycleway ||
    address.path ||
    address.place ||
    '';

  const number = address.house_number || '';
  const postcode = address.postcode || '';
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    '';

  const line1 = [street, number].filter(Boolean).join(' ');
  const line2 = [postcode, city].filter(Boolean).join(' ');

  return {
    lat: Number(data.lat),
    lng: Number(data.lon),
    street,
    number,
    postcode,
    city,
    line1,
    line2,
    attribution: 'OpenStreetMap'
  };
}
