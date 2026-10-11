import test from 'node:test';
import assert from 'node:assert/strict';
import { metersPerPixel, fadedRadiusPixels, zoomForArea, fadeStartPercent, radiusForZoom, AREA_RADIUS_PX, mountLocationArea } from '../src/ui/LocationAreaPreview.js';
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
  assert.ok(radiusForZoom(zoomForArea(100, 52), 52) >= 95);
  assert.ok(radiusForZoom(zoomForArea(1000, 52), 52) >= 975);
  assert.ok(radiusForZoom(zoomForArea(100, 52) + 1, 52) < 100,
    'zooming in should reduce recognition radius');
  assert.ok(radiusForZoom(zoomForArea(100, 52) - 1, 52) > 100,
    'zooming out should increase recognition radius');
});

test('location preview reuses existing Sharon basemap, no GPS watcher', async () => {
  const file = await readFile(new URL('../src/ui/LocationAreaPreview.js', import.meta.url), 'utf8');
  assert.ok(file.includes("environmentStyle"));
  assert.ok(file.includes("interactive: true"));
  assert.ok(file.includes("map.on('click'"));
  assert.ok(file.includes("marker.on('dragend'"));
  assert.ok(file.includes("radial") === false, 'soft edge should be CSS driven');
  assert.ok(file.includes("map.remove()"));
  assert.ok(file.includes("loadSharonRenderer(loadRenderer)"));
  assert.ok(file.includes("createSharonMap(lib"));
  assert.ok(file.includes("new ResizeObserver(resize)"));
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
    assert.equal(workerCount, 2);
    assert.equal(savedMap.options.interactive, true);
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


test('location card waits for visible dimensions and initializes after ResizeObserver', async () => {
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.ResizeObserver;
  const box = { width: 0, height: 0 };
  let onResize = null, disconnected = false, instances = 0;
  const makeElement = () => ({
    hidden: false, textContent: '', isConnected: true,
    style: { setProperty() {} }
  });
  const elements = {
    '[data-map]': { ...makeElement(), getBoundingClientRect() { return box; } },
    '[data-area-overlay]': makeElement(),
    '.sh-radius-fade': makeElement(),
    '[data-map-placeholder]': makeElement(),
    '[data-map-note]': makeElement()
  };
  const host = { innerHTML: '', querySelector(key) { return elements[key]; }, replaceChildren() {} };
  class FakeMap {
    constructor() { instances++; }
    on() {}
    resize() {}
    remove() {}
  }
  globalThis.document = { querySelector() { return {}; } };
  globalThis.ResizeObserver = class {
    constructor(fn) { onResize = fn; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  try {
    const view = mountLocationArea(host, {
      getPoint: () => ({ lat: 52, lng: 6 }),
      getRadius: () => 100,
      loadRenderer: async () => ({ Map: FakeMap })
    });
    await view.update();
    assert.equal(instances, 0);
    assert.match(elements['[data-map-placeholder]'].textContent, /scherm/i);
    box.width = 280;
    box.height = 240;
    onResize();
    // Deferred load is asynchronous. It must not need a second user tap.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(instances, 1);
    view.dispose();
    assert.equal(disconnected, true);
  } finally {
    globalThis.document = previousDocument;
    globalThis.ResizeObserver = previousObserver;
  }
});


test('read-only pin stays fixed until explicitly enabled, while map zoom changes saved radius', async () => {
  const previousDocument = globalThis.document;
  const fake = () => ({ hidden:false, isConnected:true, textContent:'', title:'',
    style:{ width:'', height:'', left:'', top:'', setProperty(){} } });
  const dom = {
    '[data-map]':fake(), '[data-area-overlay]':fake(), '.sh-radius-fade':fake(),
    '[data-map-placeholder]':fake(), '[data-map-note]':fake()
  };
  const host={ innerHTML:'', querySelector: key=>dom[key], replaceChildren(){} };
  let point={lat:52,lng:6}, radius=100, updates=0, savedMap, savedMarker;
  class MockMap {
    constructor(options){ this.options=options; this.events={}; this.currentZoom=options.zoom; savedMap=this; }
    on(name,fn){this.events[name]=fn;}
    project(){ return { x:120, y:80 }; }
    getZoom(){return this.currentZoom;}
    resize(){}
    jumpTo({zoom}){if(Number.isFinite(zoom))this.currentZoom=zoom;}
    easeTo(options){this.lastAnimation=options;}
    remove(){}
  }
  class MockMarker {
    constructor(options){this.options=options;this.events={};this.draggable=options.draggable;this.node=options.element;savedMarker=this;}
    setLngLat(coords){this.coords=coords;return this;}
    addTo(){return this;}
    on(name,fn){this.events[name]=fn;return this;}
    getLngLat(){return {lng:this.coords[0],lat:this.coords[1]};}
    setDraggable(value){this.draggable=value;}
    getElement(){return this.node;}
    remove(){}
  }
  globalThis.document={
    querySelector:()=>({}),
    createElement:()=>({setAttribute(){},className:'',classList:{toggle(){}}})
  };
  try {
    const view=mountLocationArea(host,{
      getPoint:()=>point,getRadius:()=>radius,
      onPointChange:p=>{point=p;updates++;},
      onRadiusChange:r=>{radius=r;},
      loadRenderer:async()=>({Map:MockMap,Marker:MockMarker})
    });
    await view.update();
    savedMap.events.load();
    assert.equal(savedMarker.draggable,false,'the pin must be locked on opening');
    savedMap.events.click({lngLat:{lat:52.01,lng:6.01}});
    assert.equal(updates,0,'tapping the map does not change GPS in view mode');
    const startRadius=radius;
    savedMap.currentZoom+=1;
    savedMap.events.zoom();
    assert.ok(radius<startRadius,'pinch zoom changes the recognition radius');
    assert.equal(updates,0,'zoom must never change the saved GPS position');

    assert.equal(view.setPositionEditable(true),true);
    assert.equal(savedMarker.draggable,true);
    savedMap.events.click({lngLat:{lat:52.01,lng:6.01}});
    assert.equal(updates,1,'position can change after opting into edit mode');
    assert.equal(point.lat,52.01);
    view.setPositionEditable(false);
    assert.equal(savedMarker.draggable,false);
    savedMap.events.click({lngLat:{lat:52.02,lng:6.02}});
    assert.equal(updates,1,'the edit permission is revoked when done');
    view.zoom(-.5);
    assert.ok(savedMap.lastAnimation.zoom < savedMap.currentZoom);
    assert.equal(dom['.sh-radius-fade'].style.width,AREA_RADIUS_PX*2+'px');
    view.dispose();
  } finally {
    globalThis.document=previousDocument;
  }
});
