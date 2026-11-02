import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnvironmentGpsMarker } from '../src/ui/EnvironmentMapLibre.js';

test('GPS marker receives coordinates before MapLibre attaches and draws it', () => {
  const calls = [];
  const map = { onMove: null, simulateMove() { this.onMove?.(); } };
  class Marker {
    constructor(options) {
      assert.equal(options.anchor, 'center');
      assert.equal(options.element?.id, 'gps');
      this.coordinate = null;
    }
    setLngLat(coordinate) {
      calls.push('setLngLat');
      assert.deepEqual(coordinate, [5.3, 52.2]);
      this.coordinate = coordinate;
      return this;
    }
    addTo(target) {
      calls.push('addTo');
      assert.equal(target, map);
      // Simulate the immediate MapLibre marker update and future move events.
      target.onMove = () => {
        if (!this.coordinate) throw new TypeError("undefined is not an object (evaluating 'e.lng')");
      };
      target.simulateMove();
      return this;
    }
  }
  const marker = createEnvironmentGpsMarker({ Marker }, map, { id: 'gps' }, { lat: 52.2, lng: 5.3 });
  assert.deepEqual(calls, ['setLngLat', 'addTo']);
  assert.deepEqual(marker.coordinate, [5.3, 52.2]);
  assert.doesNotThrow(() => map.simulateMove());
});
