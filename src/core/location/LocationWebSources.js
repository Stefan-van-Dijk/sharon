// Private, device-local relations between a location identifier and a web page.
// Never fetch or copy third-party page content: only store the canonical URL.
const KEY_PREFIX = 'location.webSources.v1:';
export function normalizeWebSourceUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 2048) throw new Error('Vul een geldige pagina-URL in.');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Gebruik een volledige https://-URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Alleen openbare https://-pagina’s zijn toegestaan.');
  if (!url.hostname || /^(localhost|.*\\.localhost)$/i.test(url.hostname)) throw new Error('Dit is geen publieke webpagina.');
  url.hash = '';
  return url.href;
}
export async function getPrivateWebSources(store, locationId) {
  const record = await store.get('meta', KEY_PREFIX + locationId);
  return Array.isArray(record?.value) ? record.value : [];
}
export async function addPrivateWebSource(store, locationId, input) {
  if (!locationId) throw new Error('Locatie ontbreekt.');
  const url = normalizeWebSourceUrl(input);
  const sources = await getPrivateWebSources(store, locationId);
  if (sources.some(source => source.url === url)) throw new Error('Deze pagina is al gekoppeld.');
  const source = { id: crypto.randomUUID(), locationId, url, visibility: 'private', createdAt: new Date().toISOString() };
  await store.put('meta', { key: KEY_PREFIX + locationId, value: [...sources, source] });
  return source;
}
export async function removePrivateWebSource(store, locationId, sourceId) {
  const sources = await getPrivateWebSources(store, locationId);
  await store.put('meta', { key: KEY_PREFIX + locationId, value: sources.filter(source => source.id !== sourceId) });
}
