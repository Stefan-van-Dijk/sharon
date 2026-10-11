import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, appearanceSectionFor,
  resolvedEnvironmentAppearance, sanitizeEnvironmentAppearance,
  applyEnvironmentAppearance, applyEnvironmentVisibility
} from '../src/ui/EnvironmentAppearance.js';
import { environmentZoomForSpan } from '../src/ui/EnvironmentScale.js';

test('ten logical groups contain thirty-seven distinct editable parts', () => {
  assert.deepEqual(APPEARANCE_SECTIONS.map(group => group.label),
    ['Basis', 'Water', 'Wegen', 'Transport', 'Gebouwen', 'Groen',
      'Zand & kust', 'Natte natuur', 'Landbouw', 'Rots & ijs']);
  assert.equal(APPEARANCE_GROUPS.length, 37);
  assert.equal(new Set(APPEARANCE_SECTIONS.flatMap(section => section.items)).size, 37);
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
  assert.equal(byId.get('green')['source-layer'], 'landcover');
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
  assert.ok(css.includes('grid-auto-columns:calc(100%/4)'));
  assert.ok(css.includes('backdrop-filter:blur(18px) saturate(145%)'));
});

test('every terrain subtype is a real disjoint OpenMapTiles polygon layer', () => {
  const byId = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
  const newTerrain = [
    'grassland', 'heath', 'scrub', 'meadow', 'tundra',
    'beach', 'dunes', 'sand',
    'wetland', 'bog', 'marsh', 'reedbed', 'tidalflat', 'mangrove',
    'farmland', 'orchard', 'vineyard', 'allotments', 'nursery',
    'rock', 'scree', 'glacier'
  ];
  const subtypes = new Set();
  for (const id of newTerrain) {
    const layer = byId.get(id);
    assert.ok(layer, 'missing layer for ' + id);
    assert.equal(layer.type, 'fill');
    assert.equal(layer['source-layer'], 'landcover');
    assert.equal(layer.source, 'openmaptiles');
    assert.equal(layer.paint['fill-opacity'], 1);
    assert.match(layer.paint['fill-color'], /^#[a-fA-F0-9]{6}$/);
    assert.equal(layer.filter[0], 'in');
    assert.equal(layer.filter[1][1], 'subclass');
    for (const type of layer.filter[2][1]) {
      assert.ok(!subtypes.has(type), 'duplicate terrain subtype ' + type);
      subtypes.add(type);
    }
    const group = APPEARANCE_GROUPS.find(item => item.id === id);
    assert.equal(group?.fill, id);
    assert.ok(appearanceSectionFor(id));
  }
  const forest = byId.get('forest');
  assert.deepEqual(forest.filter, ['==', ['get', 'class'], 'wood']);
  const green = byId.get('green');
  assert.equal(green['source-layer'], 'landcover');
  for (const type of green.filter[2][1])
    assert.ok(!subtypes.has(type), 'park and natural subtype overlap ' + type);
  assert.ok(environmentStyle.layers.findIndex(l => l.id === 'glacier') <
    environmentStyle.layers.findIndex(l => l.id === 'water'));
});

test('long green and wetland groups preserve group inheritance and per-part deviation', () => {
  const wetlands = APPEARANCE_SECTIONS.find(item => item.id === 'wetlands');
  const green = APPEARANCE_SECTIONS.find(item => item.id === 'green');
  assert.ok(wetlands.items.length > 4);
  assert.ok(green.items.length > 4);
  const state = sanitizeEnvironmentAppearance({
    groupStyles: {
      wetlands: { fill: '#aabbaa', from: 'region' },
      green: { fill: '#ccddee' }
    },
    reedbed: { fill: '#445566' },
    heath: { to: 'detail' }
  });
  assert.equal(resolvedEnvironmentAppearance(state, 'wetland').fill, '#aabbaa');
  assert.equal(resolvedEnvironmentAppearance(state, 'bog').fill, '#aabbaa');
  assert.equal(resolvedEnvironmentAppearance(state, 'reedbed').fill, '#445566');
  assert.equal(resolvedEnvironmentAppearance(state, 'reedbed').from, 'region');
  assert.equal(resolvedEnvironmentAppearance(state, 'heath').fill, '#ccddee');
  assert.equal(resolvedEnvironmentAppearance(state, 'heath').to, 'detail');
  const calls = [];
  const ids = new Set(environmentStyle.layers.map(layer => layer.id));
  const map = {
    getLayer: id => ids.has(id),
    setPaintProperty: (id, property, value) => calls.push({ id, property, value })
  };
  applyEnvironmentAppearance(map, state, 'group:wetlands');
  assert.ok(calls.some(entry => entry.id === 'bog' &&
    entry.property === 'fill-color' && entry.value === '#aabbaa'));
  assert.ok(calls.some(entry => entry.id === 'reedbed' &&
    entry.property === 'fill-color' && entry.value === '#445566'));
  assert.ok(!calls.some(entry => entry.id === 'heath'));
});

test('main and subcategory swipes do not change panel height or old gesture interaction', async () => {
  const { readFile } = await import('node:fs/promises');
  const [css, editor] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url), 'utf8')
  ]);
  assert.ok(css.includes('.environment-style-tabs'));
  assert.ok(css.includes('flex:0 0 auto;min-width:0!important;min-height:35px!important;'));
  assert.ok(css.includes('grid-auto-flow:column;'));
  assert.ok(css.includes('grid-auto-columns:calc(100%/4)'));
  assert.ok(css.includes('overflow-x:auto;overflow-y:hidden;scrollbar-width:none;'));
  assert.ok(css.includes('height:min(378px,65dvh'));
  assert.ok(css.includes('grid-template-rows:35px 29px 54px 44px 30px 43px 69px'));
  assert.ok(editor.includes('groups.scrollLeft = 0'));
  assert.ok(!editor.includes('for (let index = section().items.length; index < 4; index++)'));
  assert.ok(css.includes('.environment-style-group:not(:last-child)'));
  assert.ok(editor.includes('data-style-more-next'));
  assert.ok(editor.includes('dx >= 58'));
});
