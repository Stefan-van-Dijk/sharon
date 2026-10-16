// Portable card data, explicitly shared by the user; private Sharon identifiers
// and local-only location references never leave the device in the QR payload.
export const CARD_PAYLOAD_KIND = 'sharon-card';
const types = new Set(['loyalty', 'membership', 'access', 'ticket', 'other']);
const formats = new Set(['', 'QR_CODE', 'CODE128', 'EAN13', 'EAN8', 'UPC', 'UPCE', 'CODE39', 'ITF', 'codabar']);
export function buildCardPayload(card) {
  const fields = (Array.isArray(card.fields) ? card.fields : []).slice(0, 20).map(field => ({
    label: String(field.label || '').slice(0, 80),
    value: String(field.value || '').slice(0, 500)
  })).filter(field => field.label && field.value);
  const payload = {
    kind: CARD_PAYLOAD_KIND, version: 1, name: String(card.name || '').slice(0, 100),
    cardKind: types.has(card.cardKind) ? card.cardKind : 'other',
    cardNumber: String(card.cardNumber || '').slice(0, 200),
    color: /^#[0-9a-f]{6}$/i.test(card.color || '') ? card.color : '#489ff8',
    codeFormat: formats.has(card.codeFormat || '') ? card.codeFormat || '' : '',
    codeValue: String(card.codeValue || '').slice(0, 2000),
    fields
  };
  const output = JSON.stringify(payload);
  if (new TextEncoder().encode(output).length > 2000)
    throw new Error('Te veel gegevens voor één QR-code. Maak de teksten korter.');
  return output;
}
export function parseCardPayload(value) {
  if (typeof value !== 'string' || new TextEncoder().encode(value).length > 2000) return null;
  let data;
  try { data = JSON.parse(value); } catch { return null; }
  if (!data || data.kind !== CARD_PAYLOAD_KIND || data.version !== 1 ||
    typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100 ||
    !types.has(data.cardKind) || !formats.has(data.codeFormat) ||
    typeof data.cardNumber !== 'string' || data.cardNumber.length > 200 ||
    typeof data.codeValue !== 'string' || !Array.isArray(data.fields) || data.fields.length > 20 ||
    data.fields.some(field => !field || typeof field.label !== 'string' ||
      !field.label || field.label.length > 80 || typeof field.value !== 'string' ||
      !field.value || field.value.length > 500)) return null;
  return {
    name: data.name, cardKind: data.cardKind, cardNumber: data.cardNumber,
    color: /^#[0-9a-f]{6}$/i.test(data.color || '') ? data.color : '#489ff8',
    codeFormat: data.codeFormat, codeValue: data.codeValue,
    fields: data.fields.map(field => ({ label: field.label, value: field.value }))
  };
}
