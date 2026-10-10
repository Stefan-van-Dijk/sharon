import test from 'node:test';
import assert from 'node:assert/strict';
import { bindEnvironmentTouchGestures } from '../src/ui/EnvironmentGestures.js';
import { bindEnvironmentPositionButton } from '../src/ui/EnvironmentPosition.js';

function harness() {
  const listeners = new Map();
  let callback, zoom = 15;
  const pans = [], zooms = [];
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) };
  const map = { getCanvasContainer: () => element, stop() {},
    getZoom: () => zoom, getMinZoom: () => 1, getMaxZoom: () => 22,
    unproject: point => point, panBy: offset => pans.push(offset),
    easeTo: options => { zoom = options.zoom; zooms.push(options); } };
  const dispose = bindEnvironmentTouchGestures(map, () => {}, {
    requestFrame: fn => { callback = fn; return 1; }, cancelFrame: () => { callback = null; }
  });
  const send = (name, points) => {
    const event = { touches: points.map(([clientX, clientY]) => ({ clientX, clientY })),
      cancelable: true, preventDefault() {}, stopImmediatePropagation() {} };
    listeners.get(name)(event);
    if (callback) { const fn = callback; callback = null; fn(); }
  };
  return { send, pans, zooms, dispose };
}

test('a single-finger swipe after a tap pans and never zooms', () => {
  const h = harness();
  h.send('touchstart', [[100, 100]]); h.send('touchend', []);
  h.send('touchstart', [[100, 100]]); h.send('touchmove', [[100, 220]]);
  h.send('touchend', []);
  assert.equal(h.pans.length, 1);
  assert.equal(Math.abs(h.pans[0][0]), 0);
  assert.equal(h.pans[0][1], -120);
  assert.equal(h.zooms.length, 0);
  h.dispose();
});

test('two fingers swiping together pan without changing zoom', () => {
  const h = harness();
  h.send('touchstart', [[100, 100], [200, 100]]);
  h.send('touchmove', [[160, 150], [260, 150]]);
  assert.deepEqual(h.pans, [[-60, -50]]);
  assert.equal(h.zooms.length, 0);
  h.dispose();
});

test('doubling pinch distance changes zoom by only a quarter step without inertia', () => {
  const h = harness();
  h.send('touchstart', [[100, 100], [200, 100]]);
  h.send('touchmove', [[50, 100], [250, 100]]);
  assert.equal(h.zooms.length, 1);
  assert.equal(h.zooms[0].zoom, 15.25);
  assert.equal(h.zooms[0].duration, 0);
  assert.deepEqual(h.zooms[0].around, [150, 100]);
  h.send('touchend', []);
  assert.equal(h.zooms.length, 1);
  h.dispose();
});

test('changing from pinch to one finger reanchors without a jump or continued zoom', () => {
  const h = harness();
  h.send('touchstart', [[100, 100], [200, 100]]);
  h.send('touchmove', [[50, 100], [250, 100]]);
  h.send('touchend', [[250, 100]]);
  h.send('touchmove', [[260, 130]]);
  assert.deepEqual(h.pans, [[-10, -30]]);
  assert.equal(h.zooms.length, 1);
  h.dispose();
});

test('small pinch jitter is ignored', () => {
  const h = harness();
  h.send('touchstart', [[100, 100], [200, 100]]);
  h.send('touchmove', [[99, 100], [201, 100]]);
  assert.equal(h.zooms.length, 0);
  assert.equal(h.pans.length, 0);
  h.dispose();
});

test('Ik ben hier immediately reuses a known position and stays usable during GPS', async () => {
  let click, resolve, checks = 0;
  const busy = [], shown = [];
  const known = { lat: 52, lng: 6 };
  const button = { disabled: false, addEventListener: (_, fn) => click = fn,
    removeEventListener() {}, setAttribute: (_, value) => busy.push(value) };
  const dispose = bindEnvironmentPositionButton(button, {
    location: { checkNow: () => { checks++; return new Promise(r => resolve = r); } },
    getPoint: () => known, onPoint: point => shown.push(point)
  });
  const first = click();
  assert.deepEqual(shown, [known]);
  assert.equal(button.disabled, false);
  await click();
  assert.equal(checks, 1);
  assert.deepEqual(shown, [known, known]);
  const current = { lat: 52.1, lng: 6.1 };
  resolve(current); await first;
  assert.equal(shown.at(-1), current);
  assert.equal(busy.at(-1), 'false');
  dispose();
});

test('late GPS completion does not update a closed map', async () => {
  let click, resolve;
  const shown = [];
  const dispose = bindEnvironmentPositionButton({ addEventListener: (_, fn) => click = fn,
    removeEventListener() {}, setAttribute() {} }, {
    location: { checkNow: () => new Promise(r => resolve = r) },
    getPoint: () => null, onPoint: point => shown.push(point)
  });
  const pending = click(); dispose(); resolve({ lat: 52, lng: 6 }); await pending;
  assert.equal(shown.length, 0);
});
