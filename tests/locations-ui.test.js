import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openLocationsView } from '../src/ui/LocationsView.js';

test('locaties-module is een geldige ES-module', () => {
  assert.equal(typeof openLocationsView, 'function');
});

test('Sharon beheert sublocaties zonder module-import/export', async () => {
  const source = await readFile(new URL('../src/ui/LocationsView.js', import.meta.url), 'utf8');
  assert.ok(source.includes('data-create-location'));
  assert.ok(source.includes('data-add-child'));
  assert.ok(source.includes('name="parentId"'));
  assert.ok(source.includes('name="address"'));
  assert.ok(!source.includes('data-import'));
  assert.ok(source.includes('saveInHeader: false'));
});

test('service worker cachet de hiërarchiemodule met dezelfde buildversie', async () => {
  const sw = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  const build = sw.match(/const BUILD = ['\"]([^'\"]+)['\"]/)?.[1];
  assert.ok(build);
  assert.ok(sw.includes(`LocationHierarchy.js?v=${build}`));
});

test('zinnenbibliotheek gebruikt uitsluitend swipe voor kopiëren en bewaart nieuwe zinnen overal', async () => {
  const source = await readFile(new URL('../src/ui/LocationsView.js', import.meta.url), 'utf8');
  const editor = source.slice(source.indexOf('async function sentenceEditor(item)'), source.indexOf('async function edit(', source.indexOf('async function sentenceEditor(item)')));
  assert.ok(!editor.includes('name="scope"'), 'geen dubbele scopekeuze onder de invoer');
  assert.ok(editor.includes("const target=editing && editing.scope !== 'default' ? editing.scope : 'global'"));
  assert.ok(editor.includes('onEdit:id =>'));
  assert.ok(!editor.includes('onOpen:id =>'));
  assert.ok(editor.includes("dot.classList.add('sh-sentence-green')"));
  assert.ok(editor.includes('showEditor()'));
  assert.ok(editor.includes('keyboardScrollTimer = setTimeout('));
});

test('zinnenbibliotheek wisselt afstandssituaties met drie tabs', async () => {
  const source = await readFile(new URL('../src/ui/LocationsView.js', import.meta.url), 'utf8');
  const editor = source.slice(source.indexOf('async function sentenceEditor(item)'), source.indexOf('async function edit(', source.indexOf('async function sentenceEditor(item)')));
  assert.ok(editor.includes('role="tablist"'));
  assert.ok(editor.includes('data-sentence-tab='));
  assert.ok(editor.includes("selectedSituation = next"));
  assert.ok(editor.includes("selectSituation(tab.dataset.sentenceTab)"));
  assert.ok(!editor.includes('data-sentence-state'));
});

test('zinsbewerking voorkomt concurrerende scrollanimaties bij iOS-toetsenbord', async () => {
  const source = await readFile(new URL('../src/ui/LocationsView.js', import.meta.url), 'utf8');
  const editor = source.slice(source.indexOf('async function sentenceEditor(item)'), source.indexOf('async function edit(',source.indexOf('async function sentenceEditor(item)')));
  assert.ok(editor.includes('textarea.focus({ preventScroll: true })'));
  assert.ok(editor.includes('outlet.scrollTop ='));
  assert.ok(editor.includes('keyboardScrollTimer = setTimeout('));
  assert.ok(!editor.includes("visualViewport?.addEventListener('resize'"));
  assert.ok(!editor.includes("visualViewport?.addEventListener('scroll'"));
  assert.ok(!editor.includes("scrollIntoView({ behavior: 'smooth'"));
});
