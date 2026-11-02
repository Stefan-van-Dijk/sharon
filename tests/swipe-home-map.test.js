import test from 'node:test';
import assert from 'node:assert/strict';
import { bindSwipeHome } from '../src/ui/SwipeHome.js';

test('map edge dragging stays with the map while ordinary edge swipes still work', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const listeners = new Map();
  const writes = [];
  globalThis.document = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name)
  };
  globalThis.window = { innerWidth: 390 };
  const surface = {
    contains: () => true, getBoundingClientRect: () => ({ left: 0 }),
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty: (...args) => writes.push(args), removeProperty() {} }
  };
  let preventions = 0;
  const start = target => listeners.get('touchstart')({ target, touches: [{ clientX: 10, clientY: 200 }] });
  const move = () => listeners.get('touchmove')({
    touches: [{ clientX: 110, clientY: 200 }], cancelable: true,
    preventDefault: () => preventions++
  });
  let dispose;
  try {
    dispose = bindSwipeHome(surface, () => assert.fail('Unexpected navigation'));
    start({ closest: selector => selector.includes('[data-maplibre-map]') ? {} : null });
    move();
    assert.equal(preventions, 0);
    assert.equal(writes.length, 0);
    start({ closest: () => null });
    move();
    assert.equal(preventions, 1);
    assert.ok(writes.some(([key]) => key === '--home-swipe-progress'));
  } finally {
    dispose?.();
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
