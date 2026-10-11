import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEnvironmentVisibilityControl } from '../src/ui/EnvironmentVisibility.js';

test('attribution-adjacent button toggles a single scoped clean-map state and cleans up', () => {
  const oldDocument = globalThis.document;
  const flags = new Set();
  const stage = { classList: {
    toggle(name) {
      if (flags.has(name)) { flags.delete(name); return false; }
      flags.add(name); return true;
    },
    remove(name) { flags.delete(name); },
    contains(name) { return flags.has(name); }
  }};
  const elements = [];
  const make = tag => {
    const listeners = new Map(), attributes = new Map();
    const element = {
      tag, listeners, attributes, innerHTML: '',
      setAttribute: (key, value) => attributes.set(key, value),
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: (name, handler) => {
        if (listeners.get(name) === handler) listeners.delete(name);
      },
      append(child) { this.child = child; },
      remove() { this.removed = true; }
    };
    elements.push(element);
    return element;
  };
  globalThis.document = { createElement: make };
  try {
    const control = createEnvironmentVisibilityControl(stage);
    const wrapper = control.onAdd({});
    const button = wrapper.child;
    assert.equal(wrapper.className, 'maplibregl-ctrl environment-visibility-control');
    assert.equal(button.attributes.get('aria-pressed'), 'false');
    assert.equal(button.attributes.get('aria-label'), 'Kaartbediening verbergen');
    let stopped = 0;
    button.listeners.get('click')({ stopPropagation: () => stopped++ });
    assert.equal(stage.classList.contains('is-map-clean'), true);
    assert.equal(button.attributes.get('aria-pressed'), 'true');
    assert.equal(button.attributes.get('aria-label'), 'Kaartbediening tonen');
    button.listeners.get('click')({ stopPropagation: () => stopped++ });
    assert.equal(stage.classList.contains('is-map-clean'), false);
    assert.equal(stopped, 2);
    button.listeners.get('click')({ stopPropagation: () => {} });
    control.onRemove();
    assert.equal(stage.classList.contains('is-map-clean'), false, 'clean state never leaks to other modules');
    assert.equal(button.listeners.has('click'), false);
    assert.equal(wrapper.removed, true);
  } finally {
    globalThis.document = oldDocument;
  }
});

test('clean-map mode leaves MapLibre attribution visible and preserves mobile style swipe', async () => {
  const [html,map,editor,worker] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url),'utf8'),
    readFile(new URL('../src/ui/EnvironmentMapLibre.js', import.meta.url),'utf8'),
    readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url),'utf8'),
    readFile(new URL('../service-worker.js', import.meta.url),'utf8')
  ]);
  assert.ok(map.includes("map.addControl(createEnvironmentVisibilityControl(root.closest?.('.app-stage')), 'bottom-right')"));
  assert.ok(html.includes('.app-stage.is-environment.is-map-clean .app-header{'));
  assert.ok(html.includes('.app-stage.is-environment.is-map-clean .environment-readout,'));
  assert.ok(html.includes('.app-stage.is-environment.is-map-clean .environment-style-flyout,'));
  assert.ok(html.includes('.app-stage.is-environment.is-map-clean .environment-desktop-style-toggle{'));
  assert.ok(html.includes('.app-stage.is-environment.is-map-clean .environment-maplibre .maplibregl-ctrl-bottom-right{'));
  assert.ok(!html.includes('.is-map-clean .maplibregl-ctrl-attrib{display:none'));
  assert.ok(html.includes('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib{'));
  assert.ok(map.includes('attributionControl: { compact: false }'));
  assert.ok(editor.includes("listen(positionSide, 'touchstart', beginSwipe"));
  assert.ok(editor.includes("if (horizontal && dx >= 58) setStyleMode(true)"));
  assert.ok(worker.includes("EnvironmentVisibility.js?v=0.1.85"));
});
