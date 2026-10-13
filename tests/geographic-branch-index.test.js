import test from 'node:test';
import assert from 'node:assert/strict';
import { createBranchIndex, nearbyBranches, distanceMeters } from '../src/core/location/GeographicBranchIndex.js';

test('nearby branches match exact distance and keep multiple branches in one cell', () => {
  const branches = [{ id:'a', lat:51.985, lng:5.91 }, { id:'b', lat:51.98501, lng:5.91001 }, { id:'far', lat:52, lng:5.91 }];
  const index = createBranchIndex(branches);
  assert.equal(index.length, 6);
  assert.deepEqual(nearbyBranches(index, { lat:51.985, lng:5.91 }, 100).map(x => x.branch.id), ['a','b']);
});

test('neighbouring cell boundaries are checked, not only current cell', () => {
  const index = createBranchIndex([{ id:'west', lat:0, lng:-0.00001 }, { id:'east', lat:0, lng:0.00001 }]);
  assert.equal(nearbyBranches(index, { lat:0, lng:0 }, 10).length, 2);
  assert.ok(distanceMeters({lat:0,lng:0},{lat:0,lng:0.00001}) < 2);
});
