import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LocationTriggerService,
  distanceBetween
} from '../src/core/location/LocationTriggerService.js';

test('afstand tussen gelijke punten is nul', () => {
  assert.equal(
    Math.round(distanceBetween(
      { lat: 52.0, lng: 6.0 },
      { lat: 52.0, lng: 6.0 }
    )),
    0
  );
});

test('locatietrigger vuurt pas na buiten naar binnen overgang', async () => {
  let objects = [
    {
      id: 'location-1',
      type: 'location',
      updatedAt: 1,
      deletedAt: null,
      data: {
        title: 'Thuis',
        radiusM: 100,
        coordinates: { lat: 52.0, lng: 6.0 }
      }
    },
    {
      id: 'action-1',
      type: 'location-action',
      updatedAt: 1,
      deletedAt: null,
      data: {
        locationId: 'location-1',
        event: 'enter',
        enabled: true,
        message: 'Welkom thuis',
        state: null
      }
    }
  ];

  const fired = [];

  const store = {
    async getAll() {
      return structuredClone(objects);
    },
    async put(_storeName, value) {
      const index = objects.findIndex(item => item.id === value.id);
      if (index >= 0) objects[index] = structuredClone(value);
      else objects.push(structuredClone(value));
      return value.id;
    }
  };

  const events = {
    on() {
      return () => {};
    },
    emit(type, detail) {
      if (type === 'trigger.fired') fired.push(detail);
    }
  };

  const service = new LocationTriggerService({ store, events });

  await service.evaluate({ lat: 52.0, lng: 6.0 });
  assert.equal(fired.length, 0);

  await service.evaluate({ lat: 52.002, lng: 6.0 });
  assert.equal(fired.length, 0);

  await service.evaluate({ lat: 52.0, lng: 6.0 });
  assert.equal(fired.length, 1);
  assert.equal(fired[0].message, 'Welkom thuis');
});
