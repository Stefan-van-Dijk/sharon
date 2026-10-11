import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enhanceLocationEditor, keyboardInset } from '../src/ui/LocationOnboardingFlow.js';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');

test('new locations offer current GPS and manual name side by side', async () => {
  const locations = await read('../src/ui/LocationsView.js');
  const guided = await read('../src/ui/LocationOnboardingFlow.js');
  assert.equal(typeof enhanceLocationEditor, 'function');
  assert.ok(guided.includes('Welke plek?'));
  assert.ok(guided.includes('Gebruik huidige locatie'));
  assert.ok(guided.includes('Kies je huidige locatie of geef zelf een naam op.'));
  assert.ok(guided.includes('Controleer deze plek.'));
  assert.ok(locations.includes('releaseEditor = enhanceLocationEditor(root, { isNew, useGps, location, geocoder })'));
});

test('one editable overview reuses all original data fields and save handler', async () => {
  const guided = await read('../src/ui/LocationOnboardingFlow.js');
  const locations = await read('../src/ui/LocationsView.js');
  for (const field of ['fields.parent', 'fields.address', 'fields.gps', 'fields.kind', 'fields.share',
    'fields.radius', 'fields.trigger', 'fields.distance']) {
    assert.ok(guided.includes(field));
  }
  assert.ok(guided.includes('save.classList.add'));
  assert.ok(guided.includes('form.addEventListener(\'submit\''));
  assert.ok(guided.includes('showDetails();'));
  assert.ok(guided.includes('if (extra) detailExtra.append(extra)'));
  assert.ok(guided.includes('if (merge) detailExtra.append(merge)'));
  assert.ok(locations.includes('await store.put(\'objects\', saved)'));
  assert.ok(locations.includes('headerActions.append(add)'));
  assert.ok(!locations.includes('data-create-current'));
});

test('GPS is visible while reverse geocoding runs and fields remain editable', async () => {
  const code = await read('../src/ui/LocationOnboardingFlow.js');
  assert.ok(code.includes("form.elements.lat.value = point.lat"));
  assert.ok(code.includes("form.elements.lng.value = point.lng"));
  assert.ok(code.indexOf('showDetails();\n      setStatus(') < code.indexOf('const addr = await geocoder.reverse(point)'));
  assert.ok(code.includes('updatePreview()'));
  assert.ok(code.includes("focusTextField(form.elements.title)"));
});

test('keyboard footer uses visual viewport and reclaims space when dismissed', async () => {
  assert.equal(keyboardInset({ height: 500, offsetTop: 0 }, 850), 350);
  assert.equal(keyboardInset({ height: 820, offsetTop: 10 }, 830), 0);
  assert.equal(keyboardInset({ height: 800, offsetTop: 0 }, 800), 0);
  const html = await read('../index.html');
  const guided = await read('../src/ui/LocationOnboardingFlow.js');
  const sw = await read('../service-worker.js');
  assert.ok(html.includes('.sh-location-simple-footer{position:fixed'));
  assert.ok(html.includes('bottom:var(--sh-keyboard-inset,0px)'));
  assert.ok(guided.includes("viewport?.addEventListener('resize', adjustFooter)"));
  assert.ok(guided.includes("viewport?.addEventListener('scroll', adjustFooter)"));
  assert.ok(guided.includes("viewport?.removeEventListener('resize', adjustFooter)"));
  assert.ok(sw.includes("LocationOnboardingFlow.js?v=0.1.94"));
  assert.ok(sw.includes("const BUILD = '0.1.94'"));
});
