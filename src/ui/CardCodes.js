// Adapted from Log cards.js: shared QR / barcode primitives for Sharon.
// Keep encoding and decoding independent from the Cards view and ObjectStore.
export const CARD_FORMATS = Object.freeze({
  QR_CODE: 'QR-code', CODE128: 'Barcode · Code 128',
  EAN13: 'Barcode · EAN-13', EAN8: 'Barcode · EAN-8',
  UPC: 'Barcode · UPC-A', UPCE: 'Barcode · UPC-E',
  CODE39: 'Barcode · Code 39', ITF: 'Barcode · ITF',
  codabar: 'Barcode · Codabar'
});
const SCAN_FORMATS = Object.freeze({
  QR_CODE: 'QR_CODE', CODE_128: 'CODE128',
  EAN_13: 'EAN13', EAN_8: 'EAN8', UPC_A: 'UPC',
  UPC_E: 'UPCE', CODE_39: 'CODE39', ITF: 'ITF', CODABAR: 'codabar'
});
const scripts = new Map();
const asset = name => new URL('../../vendor/' + name, import.meta.url).href;
function loadScript(name, globalName) {
  if (globalThis[globalName]) return Promise.resolve();
  if (!scripts.has(name)) scripts.set(name, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = asset(name);
    script.onload = () => globalThis[globalName] ? resolve() : reject(new Error('Codebibliotheek niet beschikbaar'));
    script.onerror = () => reject(new Error('Codebibliotheek kon niet laden'));
    document.head.append(script);
  }).catch(error => { scripts.delete(name); throw error; }));
  return scripts.get(name);
}
export async function loadCardGenerator(format) {
  return format === 'QR_CODE'
    ? loadScript('qrcode-2.0.4.js', 'qrcode')
    : loadScript('jsbarcode-3.12.1.min.js', 'JsBarcode');
}
export async function loadCardScanner() {
  await loadScript('zxing-0.21.3.min.js', 'ZXing');
  return globalThis.ZXing;
}
export function validateCardCode(format, value) {
  if (!Object.hasOwn(CARD_FORMATS, format)) throw new Error('Onbekend codetype.');
  if (typeof value !== 'string' || !value.length) throw new Error('Vul code-inhoud in.');
  if (new TextEncoder().encode(value).length > 2000) throw new Error('Gebruik maximaal 2000 bytes.');
  if (format !== 'QR_CODE' && (value.length > 80 || !/^[\x20-\x7e]+$/.test(value)))
    throw new Error('Deze barcode accepteert maximaal 80 gewone tekens.');
  if (format === 'CODE39' && value !== value.toUpperCase())
    throw new Error('Code 39 vereist hoofdletters.');
  const lengths = {EAN13: 13, EAN8: 8, UPC: 12, UPCE: 8};
  if (lengths[format] && !new RegExp('^\\d{' + lengths[format] + '}$').test(value))
    throw new Error('Het gekozen codetype verwacht ' + lengths[format] + ' cijfers.');
  if (format === 'codabar' && !/^[A-D][0-9\-.$/+ :]+[A-D]$/.test(value))
    throw new Error('Codabar moet beginnen en eindigen met A, B, C of D.');
}
export async function renderCardCode(host, format, value) {
  validateCardCode(format, value);
  await loadCardGenerator(format);
  const holder = document.createElement('div');
  if (format === 'QR_CODE') {
    const qr = globalThis.qrcode(0, 'M');
    globalThis.qrcode.stringToBytes = input => Array.from(new TextEncoder().encode(input));
    qr.addData(value, 'Byte'); qr.make();
    holder.innerHTML = qr.createSvgTag({cellSize: 4, margin: 16, scalable: true});
  } else {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try { globalThis.JsBarcode(svg, value, {format, width: 2, height: 100,
      margin: 20, displayValue: false, background: '#fff', lineColor: '#000'}); }
    catch { throw new Error('De gegevens zijn ongeldig voor dit codetype.'); }
    holder.append(svg);
  }
  const svg = holder.querySelector('svg');
  if (!svg) throw new Error('Code kon niet worden opgebouwd.');
  svg.style.cssText = 'display:block;width:100%;max-height:260px;margin:auto';
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', CARD_FORMATS[format]);
  host.replaceChildren(svg);
}
export function createCardReader() {
  const ZXing = globalThis.ZXing;
  if (!ZXing) throw new Error('Scanner niet beschikbaar');
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, Object.keys(SCAN_FORMATS).map(key => ZXing.BarcodeFormat[key]));
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  return new ZXing.BrowserMultiFormatReader(hints);
}
export function decodedCard(result) {
  return { format: SCAN_FORMATS[globalThis.ZXing.BarcodeFormat[result.getBarcodeFormat()]],
    value: result.getText() };
}
