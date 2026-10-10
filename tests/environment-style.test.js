import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';

test('Sharon minimalist map renders all basemap polygons white with identifiable outlines', () => {
  const fills = environmentStyle.layers.filter(layer => layer.type === 'fill');
  assert.deepEqual(fills.map(layer => layer.id), ['water', 'building']);
  for (const layer of fills) {
    assert.equal(layer.paint['fill-color'], '#ffffff', layer.id + ' should have no grey fill');
    assert.ok(layer.paint['fill-outline-color'], layer.id + ' should keep a visible contour');
  }
  assert.equal(environmentStyle.layers.find(layer => layer.id === 'background').paint['background-color'], '#ffffff');
  assert.ok(environmentStyle.layers.some(layer => layer.id === 'highway_minor' && layer.type === 'line'));
  assert.ok(environmentStyle.layers.some(layer => layer.id === 'waterway' && layer.type === 'line'));
});
