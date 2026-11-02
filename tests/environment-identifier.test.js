import test from 'node:test';
import assert from 'node:assert/strict';

import {
  environmentBoundsForId,
  environmentIdForPoint,
  environmentParentId,
  environmentPointId,
  environmentTileId,
  isEnvironmentId
} from '../src/core/location/EnvironmentIdentifier.js?v=0.1.41';

test('environment identifiers are hierarchical prefixes', () => {
  const point = { lat: 52.0, lng: 6.0 };

  const id2 = environmentIdForPoint(point, 2);
  const id4 = environmentIdForPoint(point, 4);
  const id6 = environmentIdForPoint(point, 6);
  const id8 = environmentIdForPoint(point, 8);

  assert.equal(id4.slice(0, 2), id2);
  assert.equal(id6.slice(0, 4), id4);
  assert.equal(id8.slice(0, 6), id6);
  assert.equal(environmentParentId(id8), id6);
  assert.equal(environmentPointId(point), id8);
});

test('environment identifier bounds contain the encoded point', () => {
  const point = { lat: -33.8688, lng: 151.2093 };
  const id = environmentIdForPoint(point, 8);
  const bounds = environmentBoundsForId(id);

  assert.equal(isEnvironmentId(id), true);
  assert.ok(point.lat >= bounds.south && point.lat <= bounds.north);
  assert.ok(point.lng >= bounds.west && point.lng <= bounds.east);
});

test('map scales use stable hierarchical area ids', () => {
  const point = { lat: 51.84, lng: 5.86 };

  assert.equal(environmentTileId(point, 'region').length, 4);
  assert.equal(environmentTileId(point, 'place').length, 4);
  assert.equal(environmentTileId(point, 'street').length, 6);
  assert.equal(environmentTileId(point, 'detail').length, 6);
  assert.equal(environmentTileId(point, 'near').length, 6);
});
