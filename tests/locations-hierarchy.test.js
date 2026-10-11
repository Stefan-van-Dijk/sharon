import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addressText, locationMap, resolveLocation, isDescendant,
  pathForLocation, orderedLocations
} from '../src/core/location/LocationHierarchy.js';
import { LocationTriggerService } from '../src/core/location/LocationTriggerService.js';

function make(id, title, parentId = '', address = {}, coordinates = null) {
  return {
    id, type: 'location', deletedAt: null, updatedAt: 1,
    data: { title, parentId, address, coordinates, radiusM: 100 }
  };
}

test('sublocaties kunnen onbeperkt onder elkaar staan met eigen of geërfde gegevens', () => {
  const root = make('r', 'Bedrijf', '', { text: 'A-straat 1' }, { lat: 52, lng: 6 });
  const child = make('c', 'Gebouw', 'r', { text: 'B-straat 2' });
  const grandchild = make('g', 'Verdieping', 'c');
  const leaf = make('l', 'Ruimte', 'g', {}, { lat: 52.001, lng: 6.001 });
  const lookup = locationMap([root, child, grandchild, leaf]);
  assert.equal(pathForLocation(leaf, lookup), 'Bedrijf › Gebouw › Verdieping › Ruimte');
  assert.equal(resolveLocation(grandchild, lookup).address, 'B-straat 2');
  assert.deepEqual(resolveLocation(grandchild, lookup).coordinates, { lat: 52, lng: 6, accuracy: 0 });
  assert.equal(resolveLocation(leaf, lookup).coordinateSourceId, 'l');
  assert.equal(resolveLocation(leaf, lookup).addressSourceId, 'c');
  assert.equal(orderedLocations([leaf, root, grandchild, child]).map(x => x.depth).join(','), '0,1,2,3');
});

test('verplaatsen kan geen kring vormen', () => {
  const locations = [make('a', 'A'), make('b', 'B', 'a'), make('c', 'C', 'b')];
  const lookup = locationMap(locations);
  assert.equal(isDescendant('c', 'a', lookup), true);
  assert.equal(isDescendant('a', 'c', lookup), false);
  assert.equal(isDescendant('a', 'a', lookup), true);
});

test('zonder eigen GPS en adres erft, eigen adres blijft toegestaan', () => {
  const root = make('a', 'A', '', { street: 'Straat', number: '1', city: 'Zwolle' }, { lat: 0, lng: 0 });
  const child = make('b', 'B', 'a', { text: 'Afwijkend adres' });
  const lookup = locationMap([root, child]);
  assert.equal(addressText(root.data.address), 'Straat 1, Zwolle');
  assert.equal(resolveLocation(child, lookup).address, 'Afwijkend adres');
  assert.equal(resolveLocation(child, lookup).coordinates.lat, 0);
  assert.equal(resolveLocation(child, lookup).coordinates.lng, 0);
});

test('locatieacties gebruiken de geërfde GPS zonder extra GPS-polling', async () => {
  const objects = [
    make('a', 'Hoofd', '', {}, { lat: 52, lng: 6 }),
    make('b', 'Sub', 'a'),
    {
      id: 't', type: 'location-action', deletedAt: null,
      data: { locationId: 'b', enabled: true, event: 'enter', message: 'Welkom', state: null }
    }
  ];
  const fired = [];
  const service = new LocationTriggerService({
    store: {
      async getAll() { return structuredClone(objects); },
      async put(_, obj) {
        const i = objects.findIndex(x => x.id === obj.id);
        objects[i] = obj;
      }
    },
    events: { on() { return () => {}; }, emit(type, payload) { if (type === 'trigger.fired') fired.push(payload); } }
  });
  await service.evaluate({ lat: 52, lng: 6 });
  await service.evaluate({ lat: 52.003, lng: 6 });
  await service.evaluate({ lat: 52, lng: 6 });
  assert.equal(fired.length, 1);
  assert.equal(fired[0].locationId, 'b');
});

test('ongeldige ontbrekende GPS wordt niet als nulcoördinaat behandeld', () => {
  const item = make('a', 'A', '', {}, { lat: '', lng: '' });
  assert.equal(resolveLocation(item, locationMap([item])).coordinates, null);
});
