import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  enhanceLocationEditor, keyboardInset, nearbyKnownLocations
} from '../src/ui/LocationOnboardingFlow.js';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');

test('new location starts with a short question and offers GPS, name, or a known address', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  assert.equal(typeof enhanceLocationEditor, 'function');
  assert.ok(flow.includes('Waar ligt deze plek?'));
  assert.ok(flow.includes('Gebruik huidige locatie'));
  assert.ok(flow.includes('Naam van de plek'));
  assert.ok(flow.includes('Bestaande locatie kiezen'));
  assert.ok(flow.includes('Hoort deze plek bij '));
  assert.ok(flow.includes('Nieuwe hoofdlocatie'));
  assert.ok(flow.includes("questionButton('Sublocatie van '"));
});

test('the module has no import/export and saves in the top right', async () => {
  const locations = await read('../src/ui/LocationsView.js');
  assert.ok(locations.includes('headerActions.append(add)'));
  assert.ok(locations.includes('headerActions.append(headerSave)'));
  assert.ok(locations.includes("headerSave.textContent = isNew ? 'Voeg toe' : 'Opslaan'"));
  assert.ok(locations.includes('form.requestSubmit()'));
  assert.ok(!locations.includes('data-import'));
  assert.ok(!locations.includes('data-export'));
  assert.ok(!locations.includes('importLogLocations'));
  assert.ok(!locations.includes('exportLocations'));
  assert.ok(locations.includes("await store.put('objects', saved)"));
});

test('only stored addressed locations can become parents, with unlimited nesting', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  const locations = await read('../src/ui/LocationsView.js');
  assert.ok(flow.includes('knownLocations.filter(item => item.address)'));
  assert.ok(flow.includes('option.disabled = true'));
  assert.ok(flow.includes("showDecision([knownById.get(initialParent)])"));
  assert.ok(locations.includes('isDescendant(parentId, item.id, byId)'));
  assert.ok(locations.includes('resolveLocation(candidate, byId).address'));
});

test('nearby-address recognition is bounded by GPS accuracy and location radius', () => {
  const known = [
    { id: 'a', address: 'Dorpsstraat', radiusM: 100, coordinates: { lat: 52, lng: 5 } },
    { id: 'b', address: 'Nabij', radiusM: 100, coordinates: { lat: 52.0005, lng: 5 } },
    { id: 'c', address: '', coordinates: { lat: 52, lng: 5 } },
    { id: 'd', address: 'Ver', coordinates: { lat: 53, lng: 5 } }
  ];
  const result = nearbyKnownLocations({ lat: 52, lng: 5 }, known, 12);
  assert.deepEqual(result.map(x => x.id), ['a', 'b']);
  assert.deepEqual(nearbyKnownLocations(null, known), []);
});

test('review reuses original address field, uses soft map and accuracy-aware slider', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  const html = await read('../index.html');
  const sw = await read('../service-worker.js');
  assert.ok(flow.includes('reviewFields.append(nameField, addressField, parentField'));
  assert.ok(flow.includes('mountLocationArea(radiusHost'));
  assert.ok(flow.includes('form.elements.radiusM'));
  assert.ok(flow.includes('type="range"'));
  assert.ok(flow.includes('saveButton.hidden = true'));
  assert.ok(html.includes('sh-radius-fade'));
  assert.ok(html.includes('radial-gradient(circle'));
  assert.ok(sw.includes('LocationAreaPreview.js?v=0.1.96'));
  assert.ok(sw.includes("const BUILD = '0.1.96'"));
});

test('question navigation remains above iPhone keyboard', async () => {
  assert.equal(keyboardInset({ height: 500, offsetTop: 0 }, 850), 350);
  assert.equal(keyboardInset({ height: 820, offsetTop: 10 }, 830), 0);
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  const css = await read('../index.html');
  assert.ok(flow.includes("viewport?.addEventListener('resize', resize)"));
  assert.ok(flow.includes("viewport?.removeEventListener('scroll', resize)"));
  assert.ok(css.includes('.sh-location-question-footer{'));
  assert.ok(css.includes('bottom:var(--sh-keyboard-inset,0px)'));
});
