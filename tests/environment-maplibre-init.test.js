import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapLibreInstance } from '../src/ui/EnvironmentMapLibre.js';

test('MapLibre 6 ESM namespace can create a map without supported()', () => {
  const options = { container: 'map', zoom: 5 };
  class MockMap {
    constructor(received) { this.options = received; }
  }
  const map = createMapLibreInstance({ Map: MockMap }, options);
  assert.ok(map instanceof MockMap);
  assert.equal(map.options, options);
});

test('missing or malformed MapLibre namespace provides a readable error', () => {
  for (const invalid of [null, {}, { Map: null }, { Map: 'not a class' }]) {
    assert.throws(() => createMapLibreInstance(invalid, {}), /kaartbibliotheek/);
  }
});

test('GPU initialization failures propagate to the UI catch handler', () => {
  const error = new Error('WebGL kon niet worden gestart');
  class UnsupportedGPU {
    constructor() { throw error; }
  }
  assert.throws(() => createMapLibreInstance({ Map: UnsupportedGPU }, {}), e => e === error);
});
