import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, resolvedEnvironmentAppearance,
  sanitizeEnvironmentAppearance, applyEnvironmentAppearance, applyEnvironmentVisibility
} from '../src/ui/EnvironmentAppearance.js';
import { environmentZoomForSpan } from '../src/ui/EnvironmentScale.js';
import {
  HATCH_OPTIONS, createEnvironmentHatchTile, environmentHatchPreview,
  environmentHatchImageId, registerEnvironmentHatches
} from '../src/ui/EnvironmentHatch.js';

test('every real polygon has a fill, independent hatch and line outline; land has neither', () => {
  const layers = environmentStyle.layers;
  const byId = new Map(layers.map(l => [l.id, l]));
  const polygons = APPEARANCE_GROUPS.filter(g => g.fill);
  assert.equal(polygons.length, 26);
  const land = APPEARANCE_GROUPS.find(g => g.id === 'land');
  assert.equal(land.background, 'background');
  assert.ok(!land.fill && !land.lines?.length);
  for (const g of polygons) {
    const fill = byId.get(g.fill);
    const hatch = byId.get(g.fill + '-hatch');
    const outline = byId.get(g.fill + '-outline');
    assert.equal(fill.type, 'fill', g.id);
    assert.equal(hatch?.type, 'fill', g.id);
    assert.equal(outline?.type, 'line', g.id);
    assert.deepEqual(g.lines, [g.fill + '-outline'], g.id);
    assert.equal(hatch.layout.visibility, 'none');
    assert.equal(hatch['source-layer'], fill['source-layer']);
    assert.deepEqual(hatch.filter, fill.filter);
    assert.equal(outline['source-layer'], fill['source-layer']);
    assert.deepEqual(outline.filter, fill.filter);
    const index = layers.indexOf(fill);
    assert.equal(layers[index + 1].id, hatch.id);
    assert.equal(layers[index + 2].id, outline.id);
    assert.ok(outline.paint['line-width'] > 0);
  }
});

test('hatch tiles are seamless transparent textures with bounded pixels, no network requests', () => {
  assert.deepEqual(HATCH_OPTIONS.map(x => x.id),
    ['none', 'diagonal', 'reverse', 'fine', 'wide', 'cross', 'crossfine',
      'horizontal', 'vertical', 'grid', 'dots', 'densedots', 'dash', 'brick',
      'waves', 'diamonds']);
  assert.equal(createEnvironmentHatchTile('none'), null);
  assert.equal(createEnvironmentHatchTile('arbitrary'), null);
  for (const option of HATCH_OPTIONS.slice(1)) {
    const tile = createEnvironmentHatchTile(option.id);
    assert.equal(tile.width, 16);
    assert.equal(tile.height, 16);
    assert.equal(tile.data.length, 16 * 16 * 4);
    const alphas = Array.from(tile.data).filter((_, i) => i % 4 === 3);
    assert.ok(alphas.some(a => a === 0), option.id);
    assert.ok(alphas.some(a => a > 0), option.id);
    assert.equal(environmentHatchImageId(option.id), 'sharon-hatch-' + option.id);
  }
  const images = new Map();
  const mock = {
    hasImage: id => images.has(id),
    addImage: (id, value) => {
      assert.ok(!images.has(id));
      images.set(id, value);
    }
  };
  registerEnvironmentHatches(mock);
  registerEnvironmentHatches(mock); // idempotent after map has loaded
  assert.equal(images.size, 15);
});

test('hatch inheritance remains independent of fill and outline, with explicit none deviation', () => {
  const saved = sanitizeEnvironmentAppearance({
    groupStyles: { green: { fill: '#aabbcc', hatch: 'diagonal', stroke: '#334455' } },
    forest: { hatch: 'cross', stroke: '#667788' },
    heath: { hatch: 'none', fill: '#eef1f2' },
    land: { hatch: 'dots', fill: '#fafafa' },
    major: { hatch: 'dots' },
    green: { hatch: 'invalid', fill: '#bad' }
  });
  assert.deepEqual(saved.land, { fill: '#fafafa' });
  assert.ok(!saved.major);
  assert.ok(!saved.green);
  assert.equal(resolvedEnvironmentAppearance(saved, 'grassland').hatch, 'diagonal');
  assert.equal(resolvedEnvironmentAppearance(saved, 'forest').hatch, 'cross');
  assert.equal(resolvedEnvironmentAppearance(saved, 'forest').stroke, '#667788');
  assert.equal(resolvedEnvironmentAppearance(saved, 'heath').hatch, 'none');
  assert.equal(resolvedEnvironmentAppearance(saved, 'heath').stroke, '#334455');
  assert.equal(resolvedEnvironmentAppearance(saved, 'heath').fill, '#eef1f2');
  assert.equal(sanitizeEnvironmentAppearance(saved).groupStyles.green.hatch, 'diagonal');
});

test('MapLibre hatch overlay can be applied, switched and disabled without changing fill', () => {
  const all = new Map(environmentStyle.layers.map(l => [l.id, l]));
  const layouts = new Map();
  const paints = [];
  const container = { clientWidth: 380, clientHeight: 780 };
  let zoom = environmentZoomForSpan(300, 52, container);
  const map = {
    getLayer: id => all.get(id),
    getZoom: () => zoom,
    getCenter: () => ({ lat: 52, lng: 5 }),
    getContainer: () => container,
    getLayoutProperty: (id, key) => layouts.get(id + ':' + key),
    setLayoutProperty: (id, key, value) => layouts.set(id + ':' + key, value),
    setPaintProperty: (id, key, value) => paints.push({id, key, value}),
    setLayerZoomRange: () => {}
  };
  const initial = { groupStyles: { green: { hatch: 'diagonal', fill: '#aabbcc' } },
    heath: { hatch: 'none' } };
  applyEnvironmentAppearance(map, initial, 'group:green');
  const paint = (id, key) => paints.findLast(p => p.id === id && p.key === key)?.value;
  assert.equal(paint('forest-hatch', 'fill-pattern'), 'sharon-hatch-diagonal');
  assert.equal(paint('forest', 'fill-color'), '#aabbcc');
  assert.equal(layouts.get('forest-hatch:visibility'), 'visible');
  assert.equal(layouts.get('heath-hatch:visibility'), undefined); // default hidden
  assert.equal(paint('forest-outline', 'line-color'), '#c6c9c6');
  applyEnvironmentAppearance(map, { groupStyles: { green: { hatch: 'cross' } } }, 'group:green');
  assert.equal(paint('forest-hatch', 'fill-pattern'), 'sharon-hatch-cross');
  assert.equal(paint('forest', 'fill-color'), '#edf4ee');
  applyEnvironmentAppearance(map, {}, 'group:green');
  assert.equal(layouts.get('forest-hatch:visibility'), 'none');
  assert.equal(paint('forest', 'fill-color'), '#edf4ee');
  applyEnvironmentVisibility(map, {});
  assert.equal(layouts.get('forest-hatch:visibility'), 'none');
});

test('hatch controls only apply to polygon selections and the color row hides impossibilities', async () => {
  const { readFile } = await import('node:fs/promises');
  const [editor,css] = await Promise.all([
    readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.ok(editor.includes('data-style-hatch'));
  assert.ok(editor.includes("hatchRow.hidden = !caps.hatch"));
  assert.ok(editor.includes("strokeRow.hidden = !caps.stroke"));
  assert.ok(editor.includes("fillRow.hidden = !caps.fill"));
  assert.ok(editor.includes("hatchInput.disabled = !caps.hatch"));
  assert.ok(editor.includes("listen(hatchPicker, 'click'"));
  assert.ok(editor.includes('environmentHatchPreview'));
  assert.ok(editor.includes('data-hatch-choice'));
  assert.ok(editor.includes('data-inherit-field="hatch"'));
  assert.ok(css.includes('.environment-hatch-picker .environment-hatch-choice'));
  assert.ok(css.includes('.environment-style-group:not(:last-child)'));
  assert.ok(!css.includes('.environment-style-more-next'));
  assert.ok(!editor.includes("moreNext.textContent = '+' + remaining + ' ›'"));
  assert.ok(!editor.includes("button.setAttribute('aria-label', 'Geen onderdeel beschikbaar')"));
  assert.ok(APPEARANCE_SECTIONS.find(g => g.id === 'wetlands').items.length > 4);
});

test('every hatch has a matching vector preview with the map tile pixels', () => {
  const seen = new Set();
  for (const option of HATCH_OPTIONS) {
    const preview = environmentHatchPreview(option.id, 'choice-' + option.id);
    assert.ok(preview.startsWith('<svg viewBox="0 0 64 30"'));
    assert.ok(preview.includes('aria-hidden="true"'));
    if (option.id === 'none') continue;
    assert.ok(preview.includes('patternUnits="userSpaceOnUse"'));
    assert.ok(preview.includes('sharon-hatch-preview-choice-' + option.id));
    assert.ok(!seen.has(preview));
    seen.add(preview);
  }
  assert.equal(seen.size, 15);
});

test('buildings move into Basis without losing former per-group styles', () => {
  const old = {
    groupStyles: {
      buildings: { fill: '#d1d2d3', stroke: '#a1a2a3', hatch: 'cross', width: 2 },
      roads: { stroke: '#555555' }
    },
    buildings: { stroke: '#112233', hatch: 'none' }
  };
  const saved = sanitizeEnvironmentAppearance(old);
  assert.deepEqual(saved.buildings, {
    fill: '#d1d2d3', stroke: '#112233', hatch: 'none', width: 2
  });
  assert.equal(saved.groupStyles?.buildings, undefined);
  assert.equal(saved.groupStyles.roads.stroke, '#555555');
  assert.equal(resolvedEnvironmentAppearance(saved, 'buildings').fill, '#d1d2d3');
  assert.equal(resolvedEnvironmentAppearance(saved, 'buildings').stroke, '#112233');
  assert.equal(resolvedEnvironmentAppearance(saved, 'buildings').hatch, 'none');
  assert.equal(resolvedEnvironmentAppearance(saved, 'land').hatch, 'none');
  assert.equal(sanitizeEnvironmentAppearance(saved).buildings.width, 2);
});
