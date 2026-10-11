import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openLocationsView } from '../src/ui/LocationsView.js';

test('locaties-module is een geldige ES-module', () => {
  assert.equal(typeof openLocationsView, 'function');
});

test('Sharon opent Log-invoer en stelt een ouder bij elke locatie in', async () => {
  const source = await readFile(new URL('../src/ui/LocationsView.js', import.meta.url), 'utf8');
  assert.ok(source.includes('data-create-location'));
  assert.ok(source.includes('data-add-child'));
  assert.ok(source.includes('name="parentId"'));
  assert.ok(source.includes('name="address"'));
  assert.ok(source.includes('data-import'));
});

test('service worker cachet de hiërarchiemodule met dezelfde buildversie', async () => {
  const sw = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.ok(sw.includes('LocationHierarchy.js?v=0.1.92'));
  assert.ok(sw.includes("const BUILD = '0.1.92'"));
});
