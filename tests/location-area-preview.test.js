import test from 'node:test';
import assert from 'node:assert/strict';
import { metersPerPixel, fadedRadiusPixels } from '../src/ui/LocationAreaPreview.js';
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
});

test('location preview reuses existing Sharon basemap, no GPS watcher', async () => {
  const file = await readFile(new URL('../src/ui/LocationAreaPreview.js', import.meta.url), 'utf8');
  assert.ok(file.includes("environmentStyle"));
  assert.ok(file.includes("interactive: false"));
  assert.ok(file.includes("radial") === false, 'soft edge should be CSS driven');
  assert.ok(file.includes("map.remove()"));
  assert.ok(!file.includes("navigator.geolocation"));
});
