import test from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENT_SCALES, environmentScaleForSpan, nextEnvironmentScale,
  environmentZoomForSpan, environmentSpanForZoom, configureEnvironmentGestures,
  environmentZoomTransition } from '../src/ui/EnvironmentScale.js';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';

test('street cycles outward through all original levels and back to close detail', () => {
  let id = 'street';
  const result = [];
  for (let i = 0; i < 7; i++) {
    const scale = nextEnvironmentScale(id);
    result.push([scale.label, scale.spanM]);
    id = scale.id;
  }
  assert.deepEqual(result, [['Wijk', 3000], ['Plaats', 15000], ['Regio', 70000],
    ['Land', 700000], ['Dichtbij', 70], ['Detail', 220], ['Straat', 700]]);
});

test('every level fits the longest mobile edge in portrait and landscape', () => {
  for (const lat of [0, 52.2, 70]) {
    for (const scale of ENVIRONMENT_SCALES) {
      for (const container of [{ clientWidth: 390, clientHeight: 844 },
        { clientWidth: 844, clientHeight: 390 }]) {
        const zoom = environmentZoomForSpan(scale.spanM, lat, container);
        const span = environmentSpanForZoom(zoom, lat, container);
        assert.ok(Math.abs(span - scale.spanM) < 0.001);
        assert.equal(environmentScaleForSpan(span).id, scale.id);
      }
    }
  }
});

test('free zoom reports the nearest original level including nearby and country', () => {
  assert.equal(environmentScaleForSpan(90).label, 'Dichtbij');
  assert.equal(environmentScaleForSpan(190).label, 'Detail');
  assert.equal(environmentScaleForSpan(820).label, 'Straat');
  assert.equal(environmentScaleForSpan(650000).label, 'Land');
});

test('all input methods use native handlers with reduced zoom sensitivity', () => {
  const rates = {};
  configureEnvironmentGestures({
    touchZoomRotate: { disableRotation() {}, setZoomRate: value => rates.touch = value },
    scrollZoom: { setZoomRate: value => rates.trackpad = value,
      setWheelZoomRate: value => rates.wheel = value },
    keyboard: { disableRotation() {} }
  });
  assert.ok(rates.touch > 0 && rates.touch < 1);
  assert.ok(rates.trackpad < 1 / 100);
  assert.ok(rates.wheel < 1 / 450);
});

test('zoom transitions respect bounds, slow large jumps and keep gesture anchors', () => {
  let options;
  const map = { getZoom: () => 5, easeTo: value => options = value };
  environmentZoomTransition(map, 30);
  assert.equal(options.zoom, 22);
  assert.equal(options.duration, 1400);
  assert.equal(options.easing(0), 0);
  assert.equal(options.easing(1), 1);
  environmentZoomTransition(map, 5.5, { duration: 420, around: [6, 52] });
  assert.equal(options.zoom, 5.5);
  assert.equal(options.duration, 420);
  assert.deepEqual(options.around, [6, 52]);
  environmentZoomTransition(map, -1);
  assert.equal(options.zoom, 1);
});

test('basemap has no street/place symbols or font/sprite requests', () => {
  assert.ok(environmentStyle.layers.every(layer => layer.type !== 'symbol'));
  assert.equal(environmentStyle.glyphs, undefined);
  assert.equal(environmentStyle.sprite, undefined);
});
