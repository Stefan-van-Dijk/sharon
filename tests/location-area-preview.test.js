import test from 'node:test';
import assert from 'node:assert/strict';
import { metersPerPixel, fadedRadiusPixels, zoomForArea, fadeStartPercent, AREA_RADIUS_PX, mountLocationArea } from '../src/ui/LocationAreaPreview.js';
import { readFile } from 'node:fs/promises';

test('map fade scales in real meters without a sharp edge', () => {
  assert.ok(metersPerPixel(52, 17) > 0);
  assert.ok(metersPerPixel(52, 18) < metersPerPixel(52, 17));
  const small = fadedRadiusPixels(100, 30, 52, 17);
  const large = fadedRadiusPixels(200, 30, 52, 17);
  assert.ok(small.outer > small.core);
  assert.ok(large.outer > small.outer);
  assert.equal(small.uncertainty, 30);
  assert.ok(fadedRadiusPixels(100, 0, 52, 17).uncertainty >= 15);
  const zoom = zoomForArea(100, 52);
  const initial = fadedRadiusPixels(100, 0, 52, zoom);
  assert.ok(initial.outer > 60 && initial.outer < 90);
  assert.ok(zoomForArea(500, 52) < zoom);
  const bigger = fadedRadiusPixels(1000, 20, 52, zoomForArea(1000, 52));
  const smaller = fadedRadiusPixels(100, 20, 52, zoomForArea(100, 52));
  assert.ok(Math.abs(smaller.core - AREA_RADIUS_PX) < .01);
  assert.ok(Math.abs(bigger.core - AREA_RADIUS_PX) < .01);
  assert.ok(fadeStartPercent(1000, 20) > fadeStartPercent(100, 20),
    'larger radii must show a narrower uncertain edge');
  assert.ok(fadeStartPercent(2000, 15) > fadeStartPercent(50, 15));
});

test('location preview reuses existing Sharon basemap, no GPS watcher', async () => {
  const file = await readFile(new URL('../src/ui/LocationAreaPreview.js', import.meta.url), 'utf8');
  assert.ok(file.includes("environmentStyle"));
  assert.ok(file.includes("interactive: false"));
  assert.ok(file.includes("radial") === false, 'soft edge should be CSS driven');
  assert.ok(file.includes("map.remove()"));
  assert.ok(!file.includes("navigator.geolocation"));
});


test('map initialization configures the MapLibre ESM worker and slider zoom changes the map, not circle', async () => {
  const oldDocument = globalThis.document;
  const styles = new Map();
  const el = () => ({
    hidden: false, textContent: '', isConnected: true,
    style: { width: '', height: '', setProperty: (name, value) => styles.set(name, value) }
  });
  const nodes = {
    '[data-map]': el(),
    '[data-area-overlay]': el(),
    '.sh-radius-fade': el(),
    '[data-map-placeholder]': el(),
    '[data-map-note]': el()
  };
  const host = {
    innerHTML: '', querySelector(selector) { return nodes[selector]; },
    replaceChildren() { this.innerHTML = ''; }
  };
  globalThis.document = { querySelector() { return {}; } };
  let savedMap, workerUrl, workerCount;
  const FakeMap = class {
    constructor(options) { this.options = options; this.listeners = {}; savedMap = this; }
    on(name, handler) { this.listeners[name] = handler; }
    resize() { this.resized = true; }
    jumpTo(options) { this.lastJump = options; }
    remove() { this.removed = true; }
  };
  let radius = 100;
  try {
    const view = mountLocationArea(host, {
      getPoint: () => ({lat: 52, lng: 5}),
      getRadius: () => radius,
      getAccuracy: () => 20,
      loadRenderer: async () => ({
        Map: FakeMap, setWorkerUrl: value => { workerUrl = value; },
        setWorkerCount: value => { workerCount = value; }
      })
    });
    await view.update();
    assert.match(workerUrl, /maplibre-gl-worker\.mjs$/);
    assert.equal(workerCount, 1);
    assert.equal(savedMap.options.interactive, false);
    assert.equal(savedMap.options.center[0], 5);
    const firstZoom = savedMap.options.zoom;
    savedMap.listeners.load();
    assert.equal(nodes['[data-map-placeholder]'].hidden, true);
    assert.equal(savedMap.resized, true);
    radius = 1000;
    await view.update();
    assert.ok(savedMap.lastJump.zoom < firstZoom, 'map must zoom out for larger radius');
    assert.equal(nodes['.sh-radius-fade'].style.width, (AREA_RADIUS_PX * 2) + 'px');
    assert.equal(nodes['.sh-radius-fade'].style.height, (AREA_RADIUS_PX * 2) + 'px');
    assert.ok(styles.has('--sh-area-fade-start'));
    view.dispose();
    assert.equal(savedMap.removed, true);
  } finally {
    globalThis.document = oldDocument;
  }
});
