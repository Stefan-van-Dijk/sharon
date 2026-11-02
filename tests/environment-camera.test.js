import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnvironmentCameraControls } from '../src/ui/EnvironmentCamera.js';
import { environmentSpanForZoom } from '../src/ui/EnvironmentScale.js';

function camera() {
  let zoom = 15, controls;
  const requested = [];
  const container = { clientWidth: 390, clientHeight: 844 };
  const map = { getZoom: () => zoom, getMinZoom: () => 1, getMaxZoom: () => 22,
    getCenter: () => ({ lat: 52 }), getContainer: () => container,
    // Replacing an animation emits moveend at the intermediate zoom.
    easeTo: options => { controls.settle(); requested.push(options.zoom); } };
  controls = createEnvironmentCameraControls(map);
  return { controls, requested, container, finish: () => { zoom = requested.at(-1); controls.settle(); } };
}

test('rapid repeated zoom taps accumulate even when the previous animation has barely started', () => {
  const c = camera();
  c.controls.step(-1); c.controls.step(-1); c.controls.step(-1);
  assert.deepEqual(c.requested, [14.5, 14, 13.5]);
  c.controls.step(1); assert.equal(c.requested.at(-1), 14);
  c.finish(); c.controls.step(1); assert.equal(c.requested.at(-1), 14.5);
});

test('rapid scale taps advance through levels even when interrupted moveend events fire', () => {
  const c = camera();
  c.controls.nextScale(); c.controls.nextScale(); c.controls.nextScale();
  const spans = c.requested.map(zoom => Math.round(environmentSpanForZoom(zoom, 52, c.container)));
  assert.deepEqual(spans, [3000, 15000, 70000]);
});

test('manual dragging resets a pending zoom destination and controls still work afterwards', () => {
  const c = camera();
  c.controls.step(-1); c.controls.step(-1);
  c.controls.reset(); c.controls.step(1);
  assert.equal(c.requested.at(-1), 15.5);
  for (let i = 0; i < 30; i++) c.controls.step(1);
  assert.equal(c.requested.at(-1), 22);
});
