import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import { widthPaint, APPEARANCE_GROUPS } from '../src/ui/EnvironmentAppearance.js';

test('camera expressions for road widths keep zoom at the top level', () => {
  for (const group of APPEARANCE_GROUPS.filter(item =>
    ['minor', 'major', 'motorway', 'paths'].includes(item.id))) {
    for (const id of group.lines) {
      const layer = environmentStyle.layers.find(item => item.id === id);
      assert.ok(layer, id + ' exists');
      const original = layer.paint['line-width'];
      const scaled = widthPaint(original, 4);
      if (Array.isArray(original) && original[0] === 'interpolate') {
        assert.equal(scaled[0], 'interpolate', id);
        assert.deepEqual(scaled[2], ['zoom'], id);
        for (let i = 4; i < scaled.length; i += 2) {
          assert.equal(scaled[i], original[i] * 4, id + ' width at stop ' + original[i-1]);
        }
      } else {
        assert.equal(scaled, original * 4, id);
      }
    }
  }
});

test('native widths remain untouched for multiplier one', () => {
  const original = environmentStyle.layers.find(item =>
    item.id === 'highway_major_inner').paint['line-width'];
  assert.equal(widthPaint(original, 1), original);
});
