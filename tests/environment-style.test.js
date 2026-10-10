import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import { environmentZoomForSpan } from '../src/ui/EnvironmentScale.js';
import {
  APPEARANCE_GROUPS, appearanceDefaults, sanitizeEnvironmentAppearance,
  applyEnvironmentAppearance, applyEnvironmentVisibility, bindEnvironmentAppearance
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

test('scale visibility accepts a coarse-to-fine range and hides layers outside it', () => {
  const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
  const state = { zoom: 14 };
  const zoomRanges = [], layouts = new Map(), paints = [];
  const container = { clientWidth: 400, clientHeight: 800 };
  const map = {
    getLayer: id => layers.get(id),
    setPaintProperty: (id, property, value) => paints.push({ id, property, value }),
    setLayerZoomRange: (id, min, max) => zoomRanges.push({ id, min, max }),
    getContainer: () => container,
    getCenter: () => ({ lat: 52, lng: 5 }),
    getZoom: () => state.zoom,
    getLayoutProperty: (id, property) => layouts.get(id + ':' + property),
    setLayoutProperty: (id, property, value) => layouts.set(id + ':' + property, value)
  };
  const setScale = span => {
    state.zoom = environmentZoomForSpan(span, 52, container);
    applyEnvironmentVisibility(map, { buildings: { from: 'street', to: 'detail' } });
  };
  applyEnvironmentAppearance(map, { buildings: { from: 'street', to: 'detail' } });
  assert.ok(zoomRanges.some(entry => entry.id === 'building' && entry.min === 0));
  setScale(700); // Street: visible
  assert.equal(layouts.get('building:visibility') || 'visible', 'visible');
  setScale(220); // Detail: visible
  assert.equal(layouts.get('building:visibility') || 'visible', 'visible');
  setScale(3000); // District: too far out
  assert.equal(layouts.get('building:visibility'), 'none');
  setScale(70); // Near: too far in
  assert.equal(layouts.get('building:visibility'), 'none');
  applyEnvironmentAppearance(map, {});
  assert.equal(layouts.get('building:visibility'), 'visible');
  assert.ok(zoomRanges.some(entry => entry.id === 'building' && entry.min === 14));
  assert.ok(paints.some(entry => entry.id === 'building' && entry.property === 'fill-color'));
});

test('scale-range settings validate bounds and preserve existing customized colors', () => {
  assert.deepEqual(sanitizeEnvironmentAppearance({
    water: { fill: '#AABBCC', from: 'region', to: 'street' },
    buildings: { from: 'near', to: 'country', stroke: '#ABCDEF' },
    major: { from: 'unknown', to: 12, width: 1.5 }
  }), {
    water: { fill: '#aabbcc', from: 'region', to: 'street' },
    buildings: { from: 'near', stroke: '#abcdef' },
    major: { width: 1.5 }
  });
  assert.equal(appearanceDefaults(APPEARANCE_GROUPS[0]).from, '');
  assert.equal(appearanceDefaults(APPEARANCE_GROUPS[0]).to, '');
});

test('late settings loading cannot restyle a closed map', async () => {
  let resolve, listeners = new Map(), calls = 0;
  const map = {
    on(name, handler) { listeners.set(name, handler); },
    off(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
    getLayer: () => ({}),
    setPaintProperty: () => { calls++; }
  };
  const dispose = bindEnvironmentAppearance(map, {
    get: () => new Promise(response => resolve = response)
  });
  assert.equal(listeners.size, 2);
  dispose();
  resolve({ value: { water: { fill: '#bbccdd' } } });
  await Promise.resolve();
  assert.equal(listeners.size, 0);
  assert.equal(calls, 0);
});
