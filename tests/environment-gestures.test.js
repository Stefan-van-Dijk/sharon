import test from 'node:test';
import assert from 'node:assert/strict';
import { bindEnvironmentTouchGestures, bindEnvironmentButton } from '../src/ui/EnvironmentGestures.js';
import { bindEnvironmentPositionButton } from '../src/ui/EnvironmentPosition.js';

function harness() {
  const listeners = new Map(), captured = new Set(), pans = [], zooms = [];
  let zoom = 15;
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) };
  const dispose = bindEnvironmentTouchGestures({ getContainer: () => element, stop() {},
    getZoom: () => zoom, getMinZoom: () => 1, getMaxZoom: () => 22,
    unproject: point => point, panBy: offset => pans.push(offset),
    easeTo: options => { zoom = options.zoom; zooms.push(options); } });
  const send = (name, id, x, y, pointerType = 'mouse') => listeners.get(name)({
    pointerId: id, clientX: x, clientY: y, pointerType, button: 0,
    preventDefault() {}, stopImmediatePropagation() {} });
  const touch = (name, points) => {
    let stopped = false, prevented = false;
    listeners.get(name)({ touches: points.map(([clientX, clientY]) => ({ clientX, clientY })),
      cancelable: true, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.equal(stopped, true, 'renderer touch handlers must not run after the outer capture handler');
    return prevented;
  };
  return { send, touch, pans, zooms, captured, dispose };
}

test('single finger and mouse drag at half speed, without zoom or inertia', () => {
  for (const type of ['touch', 'mouse']) {
    const h = harness();
    if (type === 'touch') {
      h.send('pointerdown', 1, 100, 100, 'touch');
      assert.equal(h.captured.size, 0);
      h.touch('touchstart', [[100, 100]]);
      assert.equal(h.touch('touchmove', [[100, 220]]), true);
      h.touch('touchend', []);
    } else {
      h.send('pointerdown', 1, 100, 100);
      h.send('pointermove', 1, 100, 220);
      h.send('pointerup', 1, 100, 220);
    }
    assert.equal(h.pans.length, 1);
    assert.equal(h.pans[0][1], -60);
    assert.equal(h.zooms.length, 0);
    assert.equal(h.captured.size, 0);
    h.dispose();
  }
});

test('native touch pinch zooms in and out; lifting one finger reanchors', () => {
  const h = harness();
  h.touch('touchstart', [[100, 100], [200, 100]]);
  h.touch('touchmove', [[100, 100], [300, 100]]);
  assert.ok(Math.abs(h.zooms.at(-1).zoom - 15.6) < 0.00001);
  h.touch('touchmove', [[100, 100], [200, 100]]);
  assert.ok(Math.abs(h.zooms.at(-1).zoom - 15) < 0.00001);
  assert.ok(h.zooms.every(o => o.duration === 0));
  h.touch('touchend', [[200, 100]]);
  h.touch('touchmove', [[210, 130]]);
  assert.deepEqual(h.pans.at(-1), [-5, -15]);
  assert.equal(h.zooms.length, 2);
  h.touch('touchcancel', []);
  h.dispose();
});

test('touch controls work without synthetic click and do not run twice with it', () => {
  const listeners = new Map(); let count = 0;
  const unbind = bindEnvironmentButton({ addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) }, () => count++);
  const contact = { identifier: 1, clientX: 10, clientY: 20 };
  const event = { touches: [contact], changedTouches: [contact], cancelable: true,
    preventDefault() {}, stopPropagation() {} };
  listeners.get('touchstart')(event); listeners.get('touchend')(event);
  assert.equal(count, 1);
  listeners.get('click')({ detail: 1 }); assert.equal(count, 1);
  listeners.get('click')({ detail: 0 }); assert.equal(count, 2);
  listeners.get('touchstart')(event);
  listeners.get('touchmove')({ ...event, touches: [{ ...contact, clientX: 40 }] });
  listeners.get('touchend')(event);
  assert.equal(count, 2, 'moving away and back must not activate the button');
  listeners.get('touchstart')(event); listeners.get('touchcancel')(event);
  listeners.get('touchend')(event); assert.equal(count, 2);
  unbind(); assert.equal(listeners.size, 0);
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
