import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enhanceLocationEditor, suggestedParents, nearbyKnownLocations, existingLocationAtGps, parentCandidatesWithinRadius } from '../src/ui/LocationOnboardingFlow.js';
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
  assert.ok(!flow.includes('data-zoom-in'));
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

test('existing GPS places are suggested before creating a duplicate, including places without address', () => {
  const saved = [
    { id: 'here', title: 'Werk', coordinates: { lat: 52, lng: 5 }, radiusM: 100 },
    { id: 'far', title: 'Andere plek', coordinates: { lat: 53, lng: 5 }, radiusM: 100 },
    { id: 'empty', title: 'Geen GPS', coordinates: null }
  ];
  assert.equal(existingLocationAtGps({lat:52, lng:5}, saved)?.id, 'here');
  assert.equal(existingLocationAtGps({lat:52.00016, lng:5}, saved)?.id, 'here');
  assert.equal(existingLocationAtGps({lat:52.01, lng:5}, saved), null);
  assert.equal(existingLocationAtGps({lat:null, lng:null}, saved), null);
});

test('GPS lookup happens on committed address, and a fresh GPS check is made when adding', async () => {
  const source = await read('../src/ui/LocationOnboardingFlow.js');
  assert.ok(source.includes("form.elements.address.addEventListener('change'"));
  assert.ok(source.includes("void checkSavedPlaceOnStart()"));
  assert.ok(source.includes("maxAgeMs: 120_000"));
  assert.ok(source.includes('onOpenExisting(selectedExisting.id)'));
  assert.ok(source.includes("lastLookupAddress = text;"));
  assert.ok(source.includes("myRequest !== geocodeRequest"));
  assert.ok(!source.includes("address.addEventListener('input', () => { void lookupAddress()"));
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
  assert.ok(flow.includes('gpsButton.hidden = !positionEditing'));
  assert.ok(!flow.includes('data-zoom-out'));
  assert.ok(flow.includes('typeSelect.value = id'));
  assert.ok(flow.includes('mapControls.append(gpsButton)'));
  assert.ok(!flow.includes('data-radius-range'), 'a separate slider is no longer present');
  const build = worker.match(/const BUILD = [\x27"]([^\x27"]+)[\x27"]/)?.[1];
  assert.ok(build);
  assert.ok(worker.includes(`LocationOnboardingFlow.js?v=${build}`));
});

test('isolated locations show no unnecessary main-location choices', async () => {
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  assert.ok(flow.includes('parentSection.hidden = suggestions.length === 0 && !chosen'));
  assert.ok(flow.includes("nearbyKnownLocations(point, eligible, accuracy)"));
  assert.ok(flow.includes("view.querySelector('[data-more-fields]').prepend(parentLabel)"));
  assert.ok(flow.includes("moreSettings.open = true"));
});

test('nieuw en bewerken gebruiken dezelfde cirkelvormige typekeuze als onboarding', async () => {
  const [flow,story,sphere,worker] = await Promise.all([
    read('../src/ui/LocationOnboardingFlow.js'),
    read('../src/ui/Story.js'),
    read('../src/ui/LocationTypeSphere.js'),
    read('../service-worker.js')
  ]);
  assert.ok(flow.includes("mountLocationTypeSphere(typeChips"));
  assert.ok(flow.includes("selectedType: typeSelect.value"));
  assert.ok(flow.includes("typeSelect.value = id"));
  assert.ok(flow.includes("typeSphere?.refresh()"));
  assert.ok(story.includes("mountLocationTypeSphere(graph"));
  assert.ok(sphere.includes("export function mountLocationTypeSphere"));
  const version = worker.match(/const BUILD = ['"]([^'"]+)['"]/)?.[1];
  assert.ok(worker.includes('LocationTypeSphere.js?v=' + version));
});


test('typecirkel toont hoofdgroepen en subtypen in één draaibare weergave', async () => {
  const sphere = await read('../src/ui/LocationTypeSphere.js');
  const flow = await read('../src/ui/LocationOnboardingFlow.js');
  assert.ok(sphere.includes("const groups=LOCATION_GROUPS.map"));
  assert.ok(sphere.includes("entry.children.push(node)"));
  assert.ok(sphere.includes("graph.addEventListener('pointermove'"));
  assert.ok(sphere.includes("const focused=groups.find"));
  assert.ok(flow.includes("typeChips.classList.add('story-location-graph', 'story-sphere')"));
});

test('sphere type buttons keep their click so onboarding confirm can enable', async () => {
  const sphere = await read('../src/ui/LocationTypeSphere.js');
  const story = await read('../src/ui/Story.js');
  assert.ok(sphere.includes("!e.target.closest('.story-sphere-node')"));
  assert.ok(sphere.includes("graph.setPointerCapture?.(e.pointerId)"));
  assert.ok(story.includes("confirm.disabled = !id"));
  assert.ok(story.includes("data-story-continue>Opslaan"));
});

test('afronden onboarding kan geselecteerd locatietype vertalen voor opslaan', async () => {
  const story = await read('../src/ui/Story.js');
  const registry = await read('../src/core/location/LocationTypeRegistry.js');
  assert.ok(story.includes("import { locationType } from '../core/location/LocationTypeRegistry.js"));
  assert.ok(story.includes("kindLabel: locationType(kind)?.label"));
  assert.ok(registry.includes('export const locationType'));
});

test('locatie toevoegen en naam/type wijzigen hebben aparte stappen met terugknop', async () => {
 const flow = await read('../src/ui/LocationOnboardingFlow.js');
 assert.ok(flow.includes("nameSlot.hidden = stage !== 'name'"));
 assert.ok(flow.includes("typeSection.hidden = stage !== 'type'"));
 assert.ok(flow.includes("typeBack.hidden = stage !== 'type'"));
 assert.ok(flow.includes("setNewLocationStage('name', false)"));
 assert.ok(flow.includes("setNewLocationStage('type')"));
 assert.ok(flow.includes("nativeSave.hidden = (isNew || editMode === 'identity' ? stage !== 'type'"));
});

test('bovenliggende locaties worden alleen binnen herkenningsstraal voorgesteld, meest specifiek eerst', () => {
  const point = {lat:52,lng:5};
  const options=[
    {id:'thuis', title:'Thuis', coordinates:point, radiusM:150, address:''},
    {id:'garage', title:'Garage', coordinates:{lat:52.00008,lng:5},radiusM:25,address:''},
    {id:'straat', title:'Straat', coordinates:{lat:52.003,lng:5},radiusM:50},
    {id:'ontbreekt', coordinates:null}
  ];
  assert.deepEqual(parentCandidatesWithinRadius(point, options).map(x=>x.id),['garage','thuis']);
  assert.deepEqual(parentCandidatesWithinRadius(null, options),[]);
});

test('hiërarchie wordt alleen na bevestiging gewijzigd en opgeslagen met naam en type in afzonderlijke stappen', async () => {
  const flow=await read('../src/ui/LocationOnboardingFlow.js');
  const view=await read('../src/ui/LocationsView.js');
  assert.ok(flow.includes("setNewLocationStage(needsHierarchyChoice() ? 'parent' : 'name')"));
  assert.ok(flow.includes("parentSelect.value = value"));
  assert.ok(flow.includes("setNewLocationStage('name')"));
  assert.ok(flow.includes("setNewLocationStage('type')"));
  assert.ok(flow.includes("add('', 'Zelfstandige locatie'"));
  assert.ok(flow.includes("manualParent.append(parentLabel)"));
  assert.ok(view.includes("const parentId = String(values.get('parentId') || '')"));
  assert.ok(view.includes("...original, title, parentId, address"));
});

test('nieuwe locatie en plek aanpassen gebruiken dezelfde onboarding-positiebediening', async () => {
 const flow=await read('../src/ui/LocationOnboardingFlow.js');
 const story=await read('../src/ui/Story.js');
 assert.ok(flow.includes("data-sh-move=\"west\""));
 assert.ok(flow.includes("data-sh-move=\"north\""));
 assert.ok(flow.includes("const metres = 2"));
 assert.ok(flow.includes("data-position-question"));
 assert.ok(flow.includes("setPositionEditable?.(true)"));
 assert.ok(flow.includes("stage !== 'place'"));
 assert.ok(flow.includes("editMode === 'place'"));
 assert.ok(story.includes("story-location-arrows"));
 assert.ok(flow.includes("mountLocationTypeSphere(typeChips"));
});
