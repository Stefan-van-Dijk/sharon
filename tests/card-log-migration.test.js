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
  const tooMuch = {name:'Kaart',fields:Array.from({length:20},(_,i)=>({label:'Beschrijving'+i,value:'x'.repeat(500)}))};
  assert.throws(() => buildCardPayload(tooMuch), /Te veel gegevens/);
});

test('explicit location sharing transfers only a validated snapshot', () => {
  const card={name:'Pas',cardKind:'loyalty',codeFormat:'',codeValue:'',fields:[]};
  const location={title:'Winkel',address:'Dorpsstraat 1',coordinates:{lat:52,lng:5,accuracy:20},
    id:'PrivatePlace',parentId:'PrivateHouse',personIds:['PrivateUser'],notes:'Niet delen'};
  const text=buildCardPayload(card,{location});
  assert.deepEqual(parseCardPayload(text).location,{title:'Winkel',address:'Dorpsstraat 1',coordinates:{lat:52,lng:5}});
  assert.ok(!/Private|Niet delen|accuracy/.test(text));
  assert.equal(parseCardPayload(buildCardPayload(card)).location,undefined);
  assert.equal(parseCardPayload(buildCardPayload(card,{location:{title:'Adres',address:'Straat 1',coordinates:null}})).location.coordinates,null);
  for(const coordinates of [{lat:91,lng:5},{lat:52,lng:181},{lat:'52',lng:5},{lat:null,lng:null}]) {
    assert.equal(parseCardPayload(JSON.stringify({...JSON.parse(text),location:{...location,coordinates}})),null);
  }
});
