import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import { environmentZoomForSpan } from '../src/ui/EnvironmentScale.js';
import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, APPEARANCE_SCALE_OPTIONS, appearanceDefaultLineStyle,
  appearanceDefaults, appearanceSectionFor, resolvedEnvironmentAppearance, sanitizeEnvironmentAppearance,
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
  assert.deepEqual(field('highway_minor', 'line-width')[0], 'interpolate');
  assert.deepEqual(field('highway_minor', 'line-width')[2], ['zoom']);
  calls.length = 0;
  applyEnvironmentAppearance(map, {}, 'water');
  assert.equal(field('water', 'fill-color'), '#f6f8fa');
  assert.equal(field('water-outline', 'line-width'), 1);
  assert.deepEqual(field('water-outline', 'line-dasharray'), [1, 0]);
  assert.equal(field('water-outline', 'line-color'), '#dce3e8');
});

test('stored appearance rejects arbitrary paint expressions and unknown categories', () => {
  assert.equal(APPEARANCE_GROUPS.length, 41);
  assert.deepEqual(sanitizeEnvironmentAppearance({
    invented: { fill: '#abcdef' },
    water: { fill: '#AaBBcc', stroke: ['!', 'danger'], width: 900, dash: 'INVALID' },
    buildings: { fill: '#112233', width: .5, dash: 'dashed', arbitrary: true }
  }), { water: { fill: '#aabbcc' }, buildings: {
    fill: '#112233', width: .5, dash: 'dashed' } });
  assert.equal(appearanceDefaults(APPEARANCE_GROUPS.find(item => item.id === 'water')).fill, '#f6f8fa');
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
  assert.equal(appearanceDefaults(APPEARANCE_GROUPS.find(item => item.id === 'water')).from, '');
  assert.equal(appearanceDefaults(APPEARANCE_GROUPS.find(item => item.id === 'water')).to, '');
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

test('live palette updates map immediately and supersedes late saved appearance', async () => {
  const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
  const events = new Map(), paints = [], layouts = new Map(), ranges = [];
  const container = { clientWidth: 400, clientHeight: 800 };
  let zoom = environmentZoomForSpan(700, 52, container);
  let completeLoad;
  const map = {
    on(event, callback) { events.set(event, callback); },
    off(event, callback) { if (events.get(event) === callback) events.delete(event); },
    getLayer: id => layers.get(id),
    setPaintProperty: (id, name, value) => paints.push({ id, name, value }),
    setLayerZoomRange: (id, min, max) => ranges.push([id, min, max]),
    getContainer: () => container,
    getCenter: () => ({ lat: 52, lng: 5 }),
    getZoom: () => zoom,
    getLayoutProperty: (id, name) => layouts.get(id + ':' + name),
    setLayoutProperty: (id, name, value) => layouts.set(id + ':' + name, value)
  };
  const dispose = bindEnvironmentAppearance(map, {
    get: () => new Promise(resolve => { completeLoad = resolve; })
  });
  assert.equal(typeof dispose.setAppearance, 'function');
  dispose.setAppearance({ water: { fill: '#abcdef', from: 'street', to: 'detail' } }, 'water');
  assert.equal(paints.at(-4)?.id, 'water'); // New paint comes from selected category only.
  assert.ok(paints.some(call => call.id === 'water' && call.name === 'fill-color' &&
    call.value === '#abcdef'));
  assert.ok(ranges.some(([id, min]) => id === 'water' && min === 0));

  completeLoad({ value: { water: { fill: '#112233' } } });
  await Promise.resolve();
  assert.equal(paints.filter(call => call.id === 'water' && call.name === 'fill-color').at(-1).value,
    '#abcdef', 'stale IndexedDB response must not override live edits');

  zoom = environmentZoomForSpan(3000, 52, container);
  events.get('zoom')();
  assert.equal(layouts.get('water:visibility'), 'none');
  zoom = environmentZoomForSpan(220, 52, container);
  events.get('zoom')();
  assert.equal(layouts.get('water:visibility'), 'visible');

  dispose.setAppearance({}, null);
  assert.equal(layouts.get('water:visibility'), 'visible');
  dispose();
  assert.equal(events.size, 0);
});

test('style palette is available only in Omgeving and not duplicated in Settings', async () => {
  const { readFile } = await import('node:fs/promises');
  const map = await readFile(new URL('../src/ui/EnvironmentMapLibre.js', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../src/ui/SettingsView.js', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url), 'utf8');
  assert.ok(map.includes('floating: true'));
  assert.ok(map.includes('appearanceBinding?.setAppearance(next, category)'));
  assert.equal(settings.includes('data-map-style-settings'), false);
  assert.equal(settings.includes('createEnvironmentAppearanceEditor'), false);
  assert.ok(map.includes('data-style-return'));
  assert.ok(map.includes('data-readout-position'));
  assert.ok(map.includes('data-readout-style'));
  assert.ok(editor.includes('data-style-groups'));
  assert.ok(editor.includes('data-style-fill'));
  assert.ok(editor.includes('data-scale-low'));
  assert.ok(editor.includes('data-scale-high'));
  assert.equal(map.includes('data-map-zoom-in'), false);
  assert.equal(map.includes('data-map-zoom-out'), false);
});

test('editor uses three consistent stroke choices, ordered zoom handles and native defaults', async () => {
  const { createEnvironmentAppearanceEditor } = await import('../src/ui/EnvironmentAppearanceEditor.js');
  const { readFile } = await import('node:fs/promises');
  assert.equal(typeof createEnvironmentAppearanceEditor, 'function');
  assert.deepEqual(APPEARANCE_SCALE_OPTIONS.map(scale => scale.label), [
    'Dichtbij', 'Detail', 'Straat', 'Wijk', 'Plaats', 'Regio', 'Land'
  ]);
  for (const group of APPEARANCE_GROUPS) {
    assert.ok(['solid', 'dotted', 'dashed'].includes(appearanceDefaultLineStyle(group)));
  }
  const src = await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url), 'utf8');
  assert.equal((src.match(/id: '(solid|dotted|dashed)'/g) || []).length, 3);
  assert.ok(src.includes('data-dash-default'));
  assert.ok(src.includes('data-style-width'));
  assert.ok(src.includes('data-style-stroke'));
  assert.ok(src.includes('touch.clientX - bounds.left'));
  assert.ok(src.includes('dx >= 58'));
  assert.ok(src.includes("button.querySelector('svg').outerHTML = preview("));
  const stylesheet = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(stylesheet.includes('apple-mobile-web-app-status-bar-style" content="black-translucent"'));
  assert.ok(stylesheet.includes('.app-stage[data-view="detail"] .app-view'));
  assert.ok(stylesheet.includes('.environment-readout>.environment-readout-track{display:flex;gap:0'));
  assert.ok(stylesheet.includes('.environment-style-bar-actions'));
  const home = await readFile(new URL('../src/ui/SwipeHome.js', import.meta.url), 'utf8');
  assert.ok(home.includes('[data-map-readout]'));
});

test('provider attribution stays expanded, linked and centered without a separate info toggle', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/ui/EnvironmentMapLibre.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(renderer, /attributionControl:\s*\{ compact: false \}/);
  assert.ok(css.includes('.maplibregl-ctrl-attrib-button{display:none!important}'));
  assert.ok(css.includes('.maplibregl-ctrl-attrib-inner a:focus-visible'));
  assert.ok(css.includes('.maplibregl-ctrl-bottom-right{left:max(14px'));
  assert.ok(css.includes('justify-content:center'));
  // Keep MapLibre's attribution control, with shortened linked source credits.
  assert.equal(renderer.includes('attributionControl: false'), false);
  const {compactEnvironmentAttribution,OSM_MAP_CREDIT}=await import('../src/ui/EnvironmentAttribution.js');
  const original=JSON.stringify(environmentStyle);
  const configured=compactEnvironmentAttribution({...environmentStyle,sources:{...environmentStyle.sources,extra:{type:'geojson',attribution:'Extra provider'}}});
  assert.match(configured.sources.openmaptiles.attribution,/OpenMapTiles/);
  assert.ok(configured.sources.openmaptiles.attribution.includes(OSM_MAP_CREDIT));
  assert.match(OSM_MAP_CREDIT,/https:\/\/www.openstreetmap.org\/copyright/);
  assert.equal(configured.sources.extra.attribution,'Extra provider');
  assert.equal(JSON.stringify(environmentStyle),original);

});

test('shared glass header owns the map controls above full-bleed content', async () => {
  const { readFile } = await import('node:fs/promises');
  const [css, shell, map] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/Shell.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/EnvironmentMapLibre.js', import.meta.url), 'utf8')
  ]);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-header\{[\s\S]*?z-index:40;/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-header::before\{[\s\S]*?backdrop-filter:blur\(12px\)/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-header::before\{[\s\S]*?pointer-events:none;/);
  assert.ok(css.includes('.app-header-actions .environment-map-top-actions{'));
  assert.ok(css.includes('.app-stage.is-environment .environment-canvas{z-index:0}'));
  assert.ok(css.includes('.app-stage.is-environment .environment-controls{z-index:20;pointer-events:none}'));
  assert.ok(!css.includes('.app-stage.is-environment .environment-view::before{'));
  assert.ok(!css.includes('content:none!important;display:none!important;'));
  assert.ok(shell.includes('data-header-actions'));
  assert.ok(shell.includes('headerActions\n    }), { animate });'));
  assert.ok(map.includes('headerActions.replaceChildren(topActions)'));
  assert.ok(map.includes("topActions?.parentNode === headerActions"));
});

test('linked map credits sit 4px above readout with compact safe-area spacing', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const map = await readFile(new URL('../src/ui/EnvironmentMapLibre.js', import.meta.url), 'utf8');
  assert.match(css, /\.app-stage\.is-environment \.environment-readout\{\s*bottom:max\(12px,env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.environment-maplibre \.maplibregl-ctrl-bottom-right\{[\s\S]*?bottom:calc\(max\(12px,env\(safe-area-inset-bottom\)\) \+ 72px\)/);
  assert.match(css, /\.environment-maplibre \.maplibregl-ctrl-bottom-right \.maplibregl-ctrl-attrib\{[\s\S]*?min-height:18px;/);
  assert.match(css, /\.app-stage\.is-environment \.environment-style-flyout\{\s*bottom:calc\(max\(12px,env\(safe-area-inset-bottom\)\) \+ 103px\)/);
  assert.ok(css.includes('.environment-maplibre .maplibregl-ctrl-attrib-inner a:focus-visible'));
  assert.match(map, /attributionControl:\s*\{ compact: false \}/);
});

test('grouped technical raster displays real fill and stroke samples without color dots', async () => {
  const { readFile } = await import('node:fs/promises');
  const editor = await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(editor.includes('rect x="12" y="3" width="48" height="19"'));
  assert.ok(editor.includes('line x1="10" y1="13" x2="62" y2="13"'));
  assert.ok(css.includes('grid-auto-columns:calc(100%/4)'));
  assert.ok(css.includes('grid-auto-flow:column;'));
  assert.ok(css.includes('backdrop-filter:blur(18px) saturate(145%)'));
  assert.ok(!css.includes('environment-style-fill-dot'));
  assert.ok(editor.includes('ENVIRONMENT_APPEARANCE_KEY'));
});
