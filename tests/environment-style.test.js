import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import {
  APPEARANCE_GROUPS, appearanceDefaults, sanitizeEnvironmentAppearance,
  applyEnvironmentAppearance
} from '../src/ui/EnvironmentAppearance.js';

test('Sharon keeps subtle neutral basemap and separate editable polygon strokes', () => {
  const water = environmentStyle.layers.find(layer => layer.id === 'water');
  const building = environmentStyle.layers.find(layer => layer.id === 'building');
  const outlines = ['water-outline', 'building-outline'].map(id =>
    environmentStyle.layers.find(layer => layer.id === id));
  assert.equal(water.paint['fill-color'], '#f6f8fa');
  assert.equal(building.paint['fill-color'], '#fcfcfd');
  assert.deepEqual(outlines.map(layer => layer.type), ['line', 'line']);
  assert.ok(outlines.every(layer => layer.paint['line-width'] === 1));
  assert.equal(environmentStyle.layers.find(layer => layer.id === 'background').paint['background-color'], '#ffffff');
  assert.ok(environmentStyle.layers.some(layer => layer.id === 'highway_minor'));
});

test('map appearance changes fill, line paint, thickness and dots then resets correctly', () => {
  const existing = new Set(environmentStyle.layers.map(layer => layer.id));
  const calls = [];
  const map = {
    getLayer: id => existing.has(id),
    setPaintProperty: (id, key, value) => calls.push({ id, key, value })
  };
  const saved = { water: { fill: '#e9efff', stroke: '#778899', width: 2, dash: 'dotted' },
    minor: { width: 1.5, dash: 'dashed' } };
  applyEnvironmentAppearance(map, saved);
  const field = (id, key) => calls.findLast(x => x.id === id && x.key === key)?.value;
  assert.equal(field('water', 'fill-color'), '#e9efff');
  assert.equal(field('water-outline', 'line-color'), '#778899');
  assert.equal(field('water-outline', 'line-width'), 2);
  assert.deepEqual(field('water-outline', 'line-dasharray'), [0.5, 2]);
  assert.deepEqual(field('highway_minor', 'line-dasharray'), [3, 2]);
  assert.deepEqual(field('highway_minor', 'line-width')[0], '*');
  calls.length = 0;
  applyEnvironmentAppearance(map, {}, 'water');
  assert.equal(field('water', 'fill-color'), '#f6f8fa');
  assert.equal(field('water-outline', 'line-width'), 1);
  assert.deepEqual(field('water-outline', 'line-dasharray'), [1, 0]);
  assert.equal(field('water-outline', 'line-color'), '#dce3e8');
});

test('stored appearance rejects arbitrary paint expressions and unknown categories', () => {
  assert.equal(APPEARANCE_GROUPS.length, 11);
  assert.deepEqual(sanitizeEnvironmentAppearance({
    invented: { fill: '#abcdef' },
    water: { fill: '#AaBBcc', stroke: ['!', 'danger'], width: 900, dash: 'INVALID' },
    buildings: { fill: '#112233', width: .5, dash: 'dashed', arbitrary: true }
  }), { water: { fill: '#aabbcc' }, buildings: {
    fill: '#112233', width: .5, dash: 'dashed' } });
  assert.equal(appearanceDefaults(APPEARANCE_GROUPS[0]).fill, '#f6f8fa');
});
