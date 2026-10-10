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
