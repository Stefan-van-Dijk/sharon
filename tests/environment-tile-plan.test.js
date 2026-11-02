import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentBoundsForId, environmentIdForPoint } from '../src/core/location/EnvironmentIdentifier.js';
import { environmentTilePlan } from '../src/ui/EnvironmentView.js';

const canvas = { getBoundingClientRect: () => ({ width: 390, height: 844 }) };

test('small camera movement inside the same tile set does not trigger a reload', () => {
  const id = environmentIdForPoint({ lat: 52.5, lng: 6.1 }, 6);
  const center = environmentBoundsForId(id).center;
  const scale = { id: 'detail', spanM: 70 };
  const first = environmentTilePlan(center, scale, canvas);
  const nearby = environmentTilePlan({ lat: center.lat + 0.00001, lng: center.lng + 0.00001 }, scale, canvas);
  assert.equal(first.key, nearby.key);
  assert.equal(first.level, 3);
  assert.ok(first.ids.length > 0 && first.ids.length <= 9);
});

test('moving to a different area changes the planned tiles', () => {
  const scale = { id: 'detail', spanM: 70 };
  const first = environmentTilePlan({ lat: 52.5, lng: 6.1 }, scale, canvas);
  const second = environmentTilePlan({ lat: 52.52, lng: 6.12 }, scale, canvas);
  assert.notEqual(first.key, second.key);
});

test('country scale uses no detail tile requests', () => {
  const plan = environmentTilePlan({ lat: 52.5, lng: 6.1 }, { id: 'country', spanM: 700000 }, canvas);
  assert.deepEqual(plan.ids, []);
  assert.equal(plan.key, 'country');
});

test('tile requests stay bounded on mobile aspect ratios', () => {
  for (const spanM of [70, 220, 700, 3000, 15000, 70000]) {
    const plan = environmentTilePlan({ lat: 52.5, lng: 6.1 }, { id: 'detail', spanM }, canvas);
    assert.ok(plan.ids.length <= 9 || plan.level === 1, `span ${spanM}: ${plan.ids.length} areas`);
    assert.ok(plan.ids.every(id => id.length === plan.level * 2));
  }
});
