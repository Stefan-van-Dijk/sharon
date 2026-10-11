import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enhanceLocationEditor, suggestedParents, nearbyKnownLocations } from '../src/ui/LocationOnboardingFlow.js';
const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('the preferred reference uses one editable screen, not three onboarding steps', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  const css = await read('../index.html');
  assert.equal(typeof enhanceLocationEditor, 'function');
  assert.ok(flow.includes('data-location-conclusion'));
  assert.ok(flow.includes('locationConclusion('));
  assert.ok(flow.includes('sh-location-reference-address'));
  assert.ok(flow.includes('data-coordinates-text'));
  assert.ok(flow.includes('data-radius-map'));
  assert.ok(flow.includes('Herkenningsafstand aanpassen'));
  assert.ok(flow.includes('Wat voor plek is dit?'));
  assert.ok(flow.includes('Meer instellingen'));
  assert.ok(css.includes('.sh-location-reference-page'));
  assert.ok(!flow.includes('function showDecision('));
});

test('address edits are hidden behind a click and address/GPS are synchronized automatically', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  assert.ok(flow.includes('addressFields.hidden = !editing'));
  assert.ok(flow.includes("addressToggle.addEventListener('click'"));
  assert.ok(flow.includes('void lookupAddress()'));
  assert.ok(flow.includes('void reversePoint(point)'));
  assert.ok(flow.includes('onPointChange: point =>'));
  assert.ok(flow.includes("new Event('input', { bubbles: true })"));
  assert.ok(flow.includes('form.elements.address'));
  assert.ok(flow.includes('form.elements.lat'));
  assert.ok(flow.includes('form.elements.lng'));
});

test('closest saved places are proposed, but user keeps control of hierarchy', () => {
  const data = [
    { id: 'distant', title: 'Verder', address: 'd', coordinates: {lat: 53, lng: 5}},
    { id: 'close', title: 'Thuis', address: 'a', coordinates: {lat: 52, lng: 5}},
    { id: 'other', title: 'Werk', address: 'b', coordinates: {lat: 52.001, lng: 5}},
    { id: 'notAddressed', title: 'Nergens', address: '', coordinates: {lat: 52, lng: 5}}
  ];
  const candidates = suggestedParents({lat:52, lng:5}, data);
  assert.deepEqual(candidates.map(x=>x.id), ['close','other','distant']);
  assert.equal(suggestedParents({lat:52, lng:5},data,'distant')[0].id,'distant');
  assert.deepEqual(nearbyKnownLocations({lat:52,lng:5},data).map(x=>x.id),['close']);
});

test('all existing data fields and actions remain saved once', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  const locations = await read('../src/ui/LocationsView.js');
  for(const fragment of ['nameLabel','parentLabel','addressGroup','coordinatesGroup','typeLabel',
    'shareLabel','radiusLabel','triggerGroup','distanceGroup','nativeSave','extras','merge']) {
    assert.ok(flow.includes(fragment), fragment);
  }
  assert.ok(flow.includes("onModeChange('details')"));
  assert.ok(flow.includes('view.querySelector(\'[data-bottom-save]\').append(nativeSave)'));
  assert.ok(locations.includes('saveInHeader: false'));
  assert.ok(locations.includes("await store.put('objects', saved)"));
  assert.ok(!locations.includes('data-import'));
  assert.ok(!locations.includes('data-export'));
});

test('map zoom sets recognition radius; changing GPS requires explicit action', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  const worker = await read('../service-worker.js');
  assert.ok(flow.includes("onRadiusChange: radius =>"));
  assert.ok(flow.includes("form.elements.radiusM.value = String(radius)"));
  assert.ok(flow.includes("mapView?.setPositionEditable(positionEditing)"));
  assert.ok(flow.includes("view.querySelector('[data-zoom-in]')"));
  assert.ok(flow.includes("view.querySelector('[data-zoom-out]')"));
  assert.ok(flow.includes('typeSelect.value = option.value'));
  assert.ok(flow.includes('mapControls.append(gpsButton)'));
  assert.ok(!flow.includes('data-radius-range'), 'a separate slider is no longer present');
  assert.ok(worker.includes("LocationOnboardingFlow.js?v=0.1.100"));
  assert.ok(worker.includes("const BUILD = '0.1.100'"));
});

test('isolated locations show no unnecessary main-location choices', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  assert.ok(flow.includes('parentSection.hidden = suggestions.length === 0 && !chosen'));
  assert.ok(flow.includes("nearbyKnownLocations(point, eligible, accuracy)"));
  assert.ok(flow.includes("view.querySelector('[data-more-fields]').prepend(parentLabel)"));
  assert.ok(flow.includes("moreSettings.open = true"));
});
