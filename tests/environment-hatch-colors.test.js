import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnvironmentHatchTile, createEnvironmentLandHatchTile,
  environmentHatchPreview, environmentColoredHatchImageId,
  applyEnvironmentColoredHatch, DEFAULT_HATCH_COLOR
} from '../src/ui/EnvironmentHatch.js';
import {
  sanitizeEnvironmentAppearance, resolvedEnvironmentAppearance,
  applyEnvironmentAppearance, APPEARANCE_SECTIONS
} from '../src/ui/EnvironmentAppearance.js';
import { addHeightCut, editHeightBand, heightBandLabel } from '../src/ui/EnvironmentHeight.js';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';

test('default hatch color remains byte-for-byte compatible with existing Sharon data', () => {
  assert.equal(DEFAULT_HATCH_COLOR, '#3e4549');
  const tile = createEnvironmentHatchTile('diagonal');
  const first = tile.data.findIndex((value, i) => i % 4 === 3 && value !== 0) - 3;
  assert.deepEqual(Array.from(tile.data.slice(first, first + 4)), [62, 69, 73, 185]);
  assert.equal(resolvedEnvironmentAppearance({}, 'land').hatchColor, DEFAULT_HATCH_COLOR);
});

test('hatch-color controls change only hatch pigment, not fill, stroke or pattern', () => {
  const tile = createEnvironmentHatchTile('dots', '#aa5500');
  const pixels = Array.from({ length: 256 }, (_, i) => tile.data.slice(i * 4, i * 4 + 4));
  assert.ok(pixels.some(p => p[0] === 170 && p[1] === 85 && p[2] === 0 && p[3] > 0));
  assert.ok(pixels.some(p => p[3] === 0));
  assert.ok(environmentHatchPreview('dots', 'test-red', '#aa5500').includes('fill="#aa5500"'));
  assert.ok(!environmentHatchPreview('dots', 'test-blue', '#0033ff').includes('fill="#aa5500"'));
  const land = createEnvironmentLandHatchTile('#eeeeee', 'dots', '#aa5500');
  assert.ok(Array.from(land.data).some((v, i) => i % 4 === 0 && v < 238));
  assert.ok(Array.from(land.data).some(v => v === 238));
});

test('one stable sprite name per object or building-height band updates during color drag', () => {
  const images = new Map(), updates = [];
  const map = {
    hasImage: id => images.has(id),
    addImage: (id, value) => images.set(id, value),
    updateImage: (id, value) => { updates.push(id); images.set(id, value); }
  };
  for (const color of ['#000000','#111111','#223344','#ccddee'])
    assert.equal(applyEnvironmentColoredHatch(map, 'forest', 'cross', color),
      environmentColoredHatchImageId('forest'));
  assert.equal(images.size, 1);
  assert.equal(updates.length, 3);
  assert.equal(applyEnvironmentColoredHatch(map,'forest','none','#ffffff'),
    'sharon-hatch-none');
  assert.equal(applyEnvironmentColoredHatch(map,'buildings','fine','#ccddff',2),
    environmentColoredHatchImageId('buildings',2));
  assert.equal(images.size,2);
});

test('custom pigment inherits separately: group, child and height class', () => {
  const raw = {
    groupStyles: { green: {
      fill:'#eeeeee', hatch:'dots', hatchColor:'#112233', stroke:'#888888'
    }},
    forest: { hatchColor:'#aabbcc' },
    heightBands: { buildings: {
      cuts:[20], styles:[{}, {hatch:'cross', hatchColor:'#445566'}]
    }}
  };
  const saved = sanitizeEnvironmentAppearance(raw);
  assert.equal(resolvedEnvironmentAppearance(saved,'grassland').hatchColor,'#112233');
  assert.equal(resolvedEnvironmentAppearance(saved,'forest').hatchColor,'#aabbcc');
  assert.equal(resolvedEnvironmentAppearance(saved,'forest').fill,'#eeeeee');
  assert.equal(saved.heightBands.buildings.styles[1].hatchColor,'#445566');
  assert.deepEqual(sanitizeEnvironmentAppearance({
    forest:{ hatchColor:'rgba(255,1,1,1)' }
  }), {});
  assert.deepEqual(sanitizeEnvironmentAppearance(saved), saved);
});

test('MapLibre uses new colored pattern for group and data-driven height classes', () => {
  const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
  const paints = new Map(), images = new Map();
  const map = {
    getLayer:id => layers.get(id),
    getPaintProperty:(id,key) => paints.get(id+':'+key),
    setPaintProperty:(id,key,value) => paints.set(id+':'+key,value),
    addImage:(id,img) => images.set(id,img),
    hasImage:id => images.has(id),
    updateImage:(id,img) => images.set(id,img)
  };
  const band = editHeightBand(addHeightCut({},'buildings',20),
    'buildings',1,'hatchColor','#123456');
  const saved = {
    groupStyles:{basis:{hatch:'diagonal',hatchColor:'#8899aa'}},
    heightBands:band
  };
  applyEnvironmentAppearance(map,saved,'buildings');
  const expression = paints.get('building-hatch:fill-pattern');
  assert.equal(expression[0],'case');
  assert.ok(images.has(environmentColoredHatchImageId('buildings')));
  assert.ok(images.has(environmentColoredHatchImageId('buildings',1)));
  assert.equal(
    Array.from(images.get(environmentColoredHatchImageId('buildings',1)).data).some(x=>x===0x12),
    true
  );
});

test('height classes extend the existing horizontal subgroup row, even after editing and reloading', async () => {
  const {readFile} = await import('node:fs/promises');
  const editor = await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js',import.meta.url),'utf8');
  const css = await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.deepEqual(APPEARANCE_SECTIONS.find(s=>s.id==='basis').items,
    ['land','borders','buildings']);
  assert.ok(editor.includes("const subgroupEntries = () => section().items.flatMap"));
  assert.ok(editor.includes("result.push({ groupId: id, bandIndex: i"));
  assert.ok(editor.includes("button.dataset.heightParent = entry.groupId"));
  assert.ok(editor.includes("button.dataset.heightIndex = String(entry.bandIndex)"));
  assert.ok(editor.includes("event.target.closest('[data-height-parent][data-height-index]')"));
  assert.ok(editor.includes("activeHeightBand = band ? Number(band.dataset.heightIndex) : null"));
  assert.ok(editor.includes("heightBandLabel(overrides.heightBands, entry.groupId, entry.bandIndex)"));
  assert.ok(css.includes('grid-auto-flow:column;'));
  assert.ok(css.includes('grid-auto-columns:calc(100%/4)'));
  assert.ok(css.includes('.environment-style-group.is-height-band'));
  assert.ok(editor.includes('data-style-hatch-color'));
  assert.ok(editor.includes('hatchColorRow.hidden = !showHatchColor'));
  assert.ok(editor.includes("listen(hatchColorInput, 'input'"));
  assert.ok(heightBandLabel({buildings:{cuts:[20],styles:[{},{}]}},'buildings',1)
    .includes('20 m'));
});
