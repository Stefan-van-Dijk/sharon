import test from 'node:test';
import assert from 'node:assert/strict';
import { openEnvironmentView } from '../src/ui/EnvironmentMapLibre.js';

test('closing a loading map immediately cleans up and prevents a late renderer from attaching', async () => {
  const savedWindow = globalThis.window, savedDocument = globalThis.document, savedCancel = globalThis.cancelAnimationFrame;
  let resolveRenderer, constructed = 0;
  const renderer = new Promise(resolve => resolveRenderer = resolve);
  const listeners = new Map();
  const nodes = new Map(['[data-maplibre-map]', '[data-map-readout]', '[data-map-scale]',
    '[data-map-position]', '[data-map-error]'].map(key => [key, {
      addEventListener: (name, fn) => listeners.set(key + name, fn),
      removeEventListener: name => listeners.delete(key + name)
    }]));
  globalThis.cancelAnimationFrame = () => {};
  globalThis.window = { location: { search: '' } };
  globalThis.document = { querySelector: () => ({} ) };
  try {
    const cleanup = openEnvironmentView({ innerHTML: '', querySelector: key => nodes.get(key) }, {
      location: { latest: null }, events: {}, store: { get: async () => null },
      loadRenderer: () => renderer
    });
    assert.equal(typeof cleanup, 'function', 'shell must receive cleanup before CDN finishes');
    assert.equal(listeners.size, 1);
    cleanup(); assert.equal(listeners.size, 0);
    resolveRenderer({ Map: class { constructor() { constructed++; } } });
    await renderer; await Promise.resolve(); await Promise.resolve();
    assert.equal(constructed, 0);
  } finally {
    globalThis.window = savedWindow; globalThis.document = savedDocument; globalThis.cancelAnimationFrame = savedCancel;
  }
});

test('shared header map controls are mounted and removed even before renderer resolves', async () => {
  const savedWindow = globalThis.window, savedDocument = globalThis.document;
  const savedCancel = globalThis.cancelAnimationFrame;
  let resolveRenderer, mapConstructed = 0;
  const renderer = new Promise(resolve => { resolveRenderer = resolve; });
  const mapActions = {
    parentNode: null,
    remove() {
      if (this.parentNode?.replaceChildren) this.parentNode.replaceChildren();
    }
  };
  const headerActions = {
    nodes: [],
    replaceChildren(...children) {
      for (const old of this.nodes) old.parentNode = null;
      this.nodes = children;
      for (const child of children) child.parentNode = this;
    }
  };
  const listeners = new Map();
  const fake = key => ({
    addEventListener: (name, fn) => listeners.set(key + name, fn),
    removeEventListener: name => listeners.delete(key + name)
  });
  const nodes = new Map([
    ['[data-maplibre-map]', fake('map')],
    ['[data-map-scale]', fake('scale')],
    ['[data-map-position]', fake('position')],
    ['[data-map-error]', fake('error')],
    ['.environment-map-top-actions', mapActions]
  ]);
  globalThis.window = { location: { search: '' } };
  globalThis.document = { querySelector: () => ({}) };
  globalThis.cancelAnimationFrame = () => {};
  try {
    const cleanup = openEnvironmentView({ innerHTML:'', querySelector: key => nodes.get(key) }, {
      headerActions,
      location: { latest: null },
      events: {},
      store: { get: async () => null },
      loadRenderer: () => renderer
    });
    assert.equal(headerActions.nodes[0], mapActions);
    assert.equal(mapActions.parentNode, headerActions);
    cleanup();
    assert.equal(headerActions.nodes.length, 0);
    resolveRenderer({ Map: class { constructor() { mapConstructed++; } } });
    await renderer; await Promise.resolve(); await Promise.resolve();
    assert.equal(mapConstructed, 0);
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.window = savedWindow;
    globalThis.document = savedDocument;
    globalThis.cancelAnimationFrame = savedCancel;
  }
});
