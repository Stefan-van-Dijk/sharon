import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, appearanceSectionFor,
  resolvedEnvironmentAppearance, sanitizeEnvironmentAppearance,
  applyEnvironmentAppearance, applyEnvironmentVisibility
} from '../src/ui/EnvironmentAppearance.js';
import { environmentZoomForSpan } from '../src/ui/EnvironmentScale.js';

test('six logical groups contain fifteen distinct editable parts', () => {
  assert.deepEqual(APPEARANCE_SECTIONS.map(group => group.label),
    ['Basis', 'Water', 'Wegen', 'Transport', 'Gebouwen', 'Groen']);
  assert.equal(APPEARANCE_GROUPS.length, 15);
  assert.equal(new Set(APPEARANCE_SECTIONS.flatMap(section => section.items)).size, 15);
  assert.equal(appearanceSectionFor('forest').id, 'green');
  assert.equal(appearanceSectionFor('motorway').id, 'roads');
  assert.deepEqual(APPEARANCE_SECTIONS.find(group => group.id === 'transport').items,
    ['rail', 'runways', 'taxiways', 'piers']);
});

test('group color and thickness inherit separately, native defaults stay intact', () => {
  const clean = sanitizeEnvironmentAppearance({
    groupStyles: { roads: { stroke: '#667788', width: 2, dash: 'dotted' } },
    major: { stroke: '#abcdef' }
  });
  assert.equal(resolvedEnvironmentAppearance(clean, 'minor').stroke, '#667788');
  assert.equal(resolvedEnvironmentAppearance(clean, 'minor').width, 2);
  assert.equal(resolvedEnvironmentAppearance(clean, 'major').stroke, '#abcdef');
  assert.equal(resolvedEnvironmentAppearance(clean, 'major').width, 2);
  const newGroup = sanitizeEnvironmentAppearance({
    groupStyles: { roads: { stroke: '#112233', width: 3 } },
    major: { stroke: '#abcdef' }
  });
  assert.equal(resolvedEnvironmentAppearance(newGroup, 'major').stroke, '#abcdef');
  assert.equal(resolvedEnvironmentAppearance(newGroup, 'major').width, 3);
  assert.equal(resolvedEnvironmentAppearance(newGroup, 'minor').stroke, '#112233');
  assert.notEqual(resolvedEnvironmentAppearance({}, 'motorway').stroke,
    resolvedEnvironmentAppearance({}, 'minor').stroke);
});

test('existing saved colors remain, previous airfield settings split without losses', () => {
  const clean = sanitizeEnvironmentAppearance({
    water: { fill: '#abcdef', width: 1.5 },
    airfields: { stroke: '#aabbcc', width: 2, dash: 'dashed' },
    runways: { stroke: '#101010' },
    groupStyles: { roads: { stroke: ['invalid'], width: 1.5 }, bogus: { fill: '#000000' } }
  });
  assert.deepEqual(clean.water, { fill: '#abcdef', width: 1.5 });
  assert.deepEqual(clean.runways, { stroke: '#101010' });
  assert.deepEqual(clean.taxiways, { stroke: '#aabbcc', width: 2, dash: 'dashed' });
  assert.deepEqual(clean.groupStyles, { roads: { width: 1.5 } });
  assert.deepEqual(sanitizeEnvironmentAppearance(clean), clean);
});

test('land updates canvas background; forest and green are subdued genuine vector fills', () => {
  const byId = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
  assert.equal(byId.get('background').paint['background-color'], '#ffffff');
  assert.equal(byId.get('forest')['source-layer'], 'landcover');
  assert.equal(byId.get('green')['source-layer'], 'landuse');
  assert.ok(environmentStyle.layers.findIndex(l => l.id === 'forest') <
    environmentStyle.layers.findIndex(l => l.id === 'water'));
  const calls = [];
  const map = {
    getLayer: id => byId.get(id),
    setPaintProperty: (id, property, value) => calls.push([id, property, value])
  };
  applyEnvironmentAppearance(map, { groupStyles: { basis: { fill: '#eeeeee' } } }, 'group:basis');
  assert.ok(calls.some(c => c[0] === 'background' &&
    c[1] === 'background-color' && c[2] === '#eeeeee'));
  calls.length = 0;
  applyEnvironmentAppearance(map, {
    groupStyles: { green: { fill: '#aabbcc' } },
    forest: { fill: '#445566' }
  }, 'group:green');
  assert.ok(calls.some(c => c[0] === 'green' && c[2] === '#aabbcc'));
  assert.ok(calls.some(c => c[0] === 'forest' && c[2] === '#445566'));
});

test('subgroup may clear inherited scale limit without changing inherited color', () => {
  const saved = sanitizeEnvironmentAppearance({
    groupStyles: { roads: { stroke: '#aabbcc', from: 'street', to: 'detail' } },
    minor: { from: 'all', to: 'all' }
  });
  assert.equal(resolvedEnvironmentAppearance(saved, 'minor').stroke, '#aabbcc');
  assert.equal(resolvedEnvironmentAppearance(saved, 'minor').from, 'all');
  const all = new Map(environmentStyle.layers.map(l => [l.id,l]));
  const layouts = new Map();
  const container = { clientWidth: 400, clientHeight: 800 };
  let zoom = environmentZoomForSpan(3000, 52, container);
  const map = {
    getLayer: id => all.get(id),
    getZoom: () => zoom,
    getCenter: () => ({ lat: 52, lng: 5 }),
    getContainer: () => container,
    getLayoutProperty: id => layouts.get(id),
    setLayoutProperty: (id, key, value) => layouts.set(id,value)
  };
  applyEnvironmentVisibility(map, saved);
  assert.equal(layouts.get('highway_minor') || 'visible', 'visible');
  assert.equal(layouts.get('highway_major_inner'), 'none');
});

test('editor includes per-property reversion and edits group separately from children', async () => {
  const { readFile } = await import('node:fs/promises');
  const editor = await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(editor.includes('overrides.groupStyles'));
  assert.ok(editor.includes('data-style-parent'));
  assert.ok(editor.includes('data-style-inherit'));
  assert.ok(editor.includes('data-inherit-field'));
  assert.ok(editor.includes('data-style-fill-hex'));
  assert.ok(editor.includes('dx >= 58'));
  assert.ok(editor.includes('ENVIRONMENT_APPEARANCE_KEY'));
  assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;'));
  assert.ok(css.includes('backdrop-filter:blur(18px) saturate(145%)'));
});
