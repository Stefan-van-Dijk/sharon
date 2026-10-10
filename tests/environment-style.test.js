import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';

test('Sharon basemap uses barely grey buildings and subtle grey-blue water', () => {
  const fills = environmentStyle.layers.filter(layer => layer.type === 'fill');
  assert.deepEqual(fills.map(layer => layer.id), ['water', 'building']);
  const [water, building] = fills;
  assert.equal(water.paint['fill-color'], '#f6f8fa');
  assert.equal(water.paint['fill-outline-color'], '#dce3e8');
  assert.equal(building.paint['fill-color'], '#fcfcfd');
  assert.equal(building.paint['fill-outline-color'], '#dddddf');
  assert.equal(environmentStyle.layers.find(layer => layer.id === 'background').paint['background-color'], '#ffffff');
  assert.ok(environmentStyle.layers.some(layer => layer.id === 'highway_minor' && layer.type === 'line'));
  assert.ok(environmentStyle.layers.some(layer => layer.id === 'waterway' && layer.type === 'line'));
});
