import test from 'node:test';
import assert from 'node:assert/strict';
import {
  environmentFeatureForObject,
  environmentGeoJSON,
  validMapGeometry
} from '../src/ui/EnvironmentData.js';

test('a saved Sharon location becomes a local Point without copying private fields', () => {
  const result = environmentFeatureForObject({
    id: 'loc-1', externalId: 'AbCdEfGhIj12', type: 'location',
    data: { title: 'Werk', coordinates: { lat: 52.5, lng: 6.1 },
      address: 'Private address', notes: 'Do not publish', privateToken: 'secret' }
  });
  assert.deepEqual(result.geometry, { type: 'Point', coordinates: [6.1, 52.5] });
  assert.equal(result.properties.externalId, 'AbCdEfGhIj12');
  assert.equal(result.properties.title, 'Werk');
  assert.ok(!JSON.stringify(result).includes('Private address'));
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('unrelated private objects and deleted objects are never added to the map', () => {
  const input = [
    { id: 'task-1', type: 'task', data: { coordinates: { lng: 6, lat: 52 } } },
    { id: 'deleted-1', type: 'location', deletedAt: '2026-10-09', data: { coordinates: { lng: 6, lat: 52 } } },
    { id: 'loc-2', type: 'location', data: { title: 'Saved', coordinates: { lat: 52, lng: 6 } } }
  ];
  const data = environmentGeoJSON(input);
  assert.equal(data.type, 'FeatureCollection');
  assert.deepEqual(data.features.map(feature => feature.properties.id), ['loc-2']);
});

test('explicit geographic objects use one stable ID for a whole polygon', () => {
  const geometry = { type: 'Polygon', coordinates: [[[6.1, 52.5], [6.2, 52.5],
    [6.2, 52.6], [6.1, 52.5]]] };
  const object = { id: 'building-12', type: 'building',
    data: { title: 'Gebouw', environment: {
      visible: true, geometry, sourceId: 'osm:way:1234' } }
  };
  const feature = environmentFeatureForObject(object);
  assert.deepEqual(feature.geometry, geometry);
  assert.equal(feature.properties.id, 'building-12');
  assert.equal(feature.properties.sourceId, 'osm:way:1234');
});

test('invalid coordinates and incomplete geometries are rejected', () => {
  assert.equal(validMapGeometry({ type: 'Point', coordinates: [null, 52] }), false);
  assert.equal(validMapGeometry({ type: 'LineString', coordinates: [[6,52]] }), false);
  assert.equal(validMapGeometry({ type: 'Polygon', coordinates: [[[6,52], [7,52], [7,53]]] }), false);
  assert.equal(environmentFeatureForObject({
    id: 'loc', type: 'location', data: { coordinates: { lat: 95, lng: 6 } }
  }), null);
});

test('points and multilines may be visualized without generating world tiles', () => {
  const data = environmentGeoJSON([
    { id: 'line-1', type: 'line', data: { showOnMap: true,
      geometry: { type: 'MultiLineString', coordinates: [
        [[6, 52], [7, 52]], [[7, 52], [7, 53]]
      ] } } },
    { id: 'private-line', type: 'line', data: { geometry: {
      type: 'LineString', coordinates: [[6,52], [7,52]]
    } } }
  ]);
  assert.equal(data.features.length, 1);
  assert.equal(data.features[0].geometry.type, 'MultiLineString');
});
