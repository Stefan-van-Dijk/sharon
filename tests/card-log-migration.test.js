import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_FORMATS, validateCardCode } from '../src/ui/CardCodes.js';
import { buildCardPayload, parseCardPayload } from '../src/ui/CardPayload.js';

test('Log barcode formats including leading zeros and Unicode QR contents', () => {
  assert.ok(Object.keys(CARD_FORMATS).length >= 9);
  assert.doesNotThrow(() => validateCardCode('CODE128', '000123456789'));
  assert.doesNotThrow(() => validateCardCode('QR_CODE', 'Welkom – informatie ✓'));
  assert.throws(() => validateCardCode('EAN13', '123'), /13 cijfers/);
  assert.throws(() => validateCardCode('CODE39', 'abc'), /hoofdletters/);
});

test('Sharing card QR transfers own details but not local identifiers or locations', () => {
  const source = {id:'private12-id',type:'card',name:'Jumbo',cardKind:'loyalty',
    cardNumber:'000123',codeFormat:'CODE128',codeValue:'000123',locationId:'secret-location',
    fields:[{label:'Eigenaar',value:'Gezin'}],createdAt:'secret',updatedAt:'secret'};
  const payload = buildCardPayload(source);
  const result = parseCardPayload(payload);
  assert.equal(result.name, 'Jumbo');
  assert.equal(result.cardNumber, '000123');
  assert.deepEqual(result.fields, [{label:'Eigenaar',value:'Gezin'}]);
  assert.ok(!payload.includes('private12-id'));
  assert.ok(!payload.includes('secret-location'));
  assert.ok(!payload.includes('createdAt'));
});
test('Imported data rejects unknown and oversized schemas', () => {
  assert.equal(parseCardPayload('not-json'), null);
  assert.equal(parseCardPayload(JSON.stringify({kind:'log-code',version:1})), null);
  const tooMuch = {name:'Kaart',fields:[{label:'Beschrijving',value:'x'.repeat(2500)}]};
  assert.throws(() => buildCardPayload(tooMuch), /Te veel gegevens/);
});
