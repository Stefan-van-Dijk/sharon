import test from 'node:test';
import assert from 'node:assert/strict';
import { IdentifierService } from '../src/core/ids/IdentifierService.js';

test('identifier heeft exact 12 toegestane tekens', () => {
  const fakeCrypto = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index;
      }
      return bytes;
    }
  };

  const id = IdentifierService.create(fakeCrypto);
  assert.equal(id.length, 12);
  assert.equal(IdentifierService.isValid(id), true);
});

test('ongeldige identifiers worden afgewezen', () => {
  assert.equal(IdentifierService.isValid('abc'), false);
  assert.equal(IdentifierService.isValid('abcdefghijkl!'), false);
  assert.throws(() => IdentifierService.assert('abc'));
});
