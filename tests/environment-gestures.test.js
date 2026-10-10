import test from 'node:test';
import assert from 'node:assert/strict';
import { bindEnvironmentTouchGestures, bindEnvironmentButton } from '../src/ui/EnvironmentGestures.js';
import { bindEnvironmentPositionButton } from '../src/ui/EnvironmentPosition.js';

function harness() {
  const listeners = new Map(), captured = new Set(), updates = [];
  const container = { clientWidth: 400, clientHeight: 800,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name)
  };
  let center = { lng: 0, lat: 0 }, zoom = 4, stops = 0, manuals = 0;
  const map = {
    getContainer: () => container,
    getZoom: () => zoom, getMinZoom: () => 1, getMaxZoom: () => 22,
    stop() { stops++; },
    unproject([x, y]) { const scale = 2 ** zoom;
      return { lng: center.lng + (x - 200) / scale,
        lat: center.lat + (y - 400) / scale }; },
    project(geo) { const scale = 2 ** zoom;
      return { x: 200 + (geo.lng - center.lng) * scale,
        y: 400 + (geo.lat - center.lat) * scale }; },
    jumpTo(options) { zoom = options.zoom; center = options.center; updates.push(options); }
  };
  const dispose = bindEnvironmentTouchGestures(map, () => manuals++);
  const send = (name, id, x, y, pointerType = 'mouse') => listeners.get(name)({
    pointerId: id, clientX: x, clientY: y, pointerType, button: 0,
    preventDefault() {}, stopImmediatePropagation() {}, target: null
  });
  const touch = (name, points) => {
    let stopped = false, prevented = false;
    listeners.get(name)({ touches: points.map(([clientX, clientY]) => ({ clientX, clientY })),
      target: null, cancelable: true, preventDefault() { prevented = true; },
      stopImmediatePropagation() { stopped = true; } });
    assert.equal(stopped, true);
    return prevented;
  };
  return { map, touch, send, updates, captured, dispose,
    get stops() { return stops; }, get manuals() { return manuals; } };
}

test('one-finger and mouse pan follow 1:1 without starting delayed animations', () => {
  for (const type of ['touch', 'mouse']) {
    const h = harness();
    if (type === 'touch') {
      h.send('pointerdown', 1, 100, 100, 'touch');
      assert.equal(h.captured.size, 0);
      h.touch('touchstart', [[100, 100]]);
      h.touch('touchmove', [[200, 220]]);
      h.touch('touchend', []);
    } else {
      h.send('pointerdown', 1, 100, 100);
      h.send('pointermove', 1, 200, 220);
      h.send('pointerup', 1, 200, 220);
    }
    assert.equal(h.updates.length, 1);
    assert.equal(h.map.project({ lng: -6.25, lat: -18.75 }).x, 200);
    assert.deepEqual(h.map.project({ lng: -6.25, lat: -18.75 }), { x: 200, y: 220 });
    assert.equal(h.updates[0].zoom, 4);
    assert.equal(h.stops, 1);
    h.dispose();
  }
});

test('two touching map points remain under both fingers while pinching and moving', () => {
  const h = harness();
  const p1 = h.map.unproject([100, 100]), p2 = h.map.unproject([200, 100]);
  h.touch('touchstart', [[100, 100], [200, 100]]);
  h.touch('touchmove', [[90, 105], [310, 105]]);
  assert.equal(h.updates.length, 1, 'only one camera operation per move');
  assert.ok(Math.abs(h.map.getZoom() - (4 + Math.log2(2.2))) < 1e-10);
  for (const [geo, x, y] of [[p1, 90, 105], [p2, 310, 105]]) {
    const actual = h.map.project(geo);
    assert.ok(Math.abs(actual.x - x) < 1e-8);
    assert.ok(Math.abs(actual.y - y) < 1e-8);
  }
  h.touch('touchend', [[310, 105]]);
  h.touch('touchmove', [[340, 135]]);
  assert.equal(h.updates.length, 2);
  h.touch('touchcancel', []);
  h.dispose();
});

test('a tap does not cancel camera animations; tiny movements activate as one gesture', () => {
  const h = harness();
  h.touch('touchstart', [[100, 100]]); h.touch('touchend', []);
  assert.equal(h.stops, 0);
  h.touch('touchstart', [[100, 100], [200, 100]]);
  for (let i = 1; i <= 12; i++) h.touch('touchmove', [[100, 100], [200 + i * .25, 100]]);
  assert.ok(h.updates.length > 0);
  assert.equal(h.stops, 1);
  assert.equal(h.manuals, 1);
  h.touch('touchend', []);
  h.dispose();
});

test('buttons use browser clicks for touch, mouse and keyboard without cancelling touch events', () => {
  const button = new EventTarget(); let count = 0;
  const dispose = bindEnvironmentButton(button, () => count++);
  const start = new Event('touchstart', { cancelable: true });
  button.dispatchEvent(start);
  assert.equal(start.defaultPrevented, false);
  button.dispatchEvent(new Event('click')); // browser activation after a tap
  button.dispatchEvent(new Event('click')); // repeated activation
  assert.equal(count, 2);
  dispose(); button.dispatchEvent(new Event('click'));
  assert.equal(count, 2);
});

test('Ik ben hier immediately reuses a known position and stays usable during GPS', async () => {
  let click, resolve, checks = 0;
  const busy = [], shown = [];
  const known = { lat: 52, lng: 6 };
  const button = { disabled: false, addEventListener: (name, fn) => { if (name === 'click') click = fn; },
    removeEventListener() {}, setAttribute: (_, value) => busy.push(value) };
  const dispose = bindEnvironmentPositionButton(button, {
    location: { checkNow: () => { checks++; return new Promise(r => resolve = r); } },
    getPoint: () => known, onPoint: point => shown.push(point)
  });
  const first = click({ detail: 0 });
  assert.deepEqual(shown, [known]);
  assert.equal(button.disabled, false);
  await click({ detail: 0 });
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
  const dispose = bindEnvironmentPositionButton({ addEventListener: (name, fn) => { if (name === 'click') click = fn; },
    removeEventListener() {}, setAttribute() {} }, {
    location: { checkNow: () => new Promise(r => resolve = r) },
    getPoint: () => null, onPoint: point => shown.push(point)
  });
  const pending = click({ detail: 0 }); dispose(); resolve({ lat: 52, lng: 6 }); await pending;
  assert.equal(shown.length, 0);
});
