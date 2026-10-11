import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAPLIBRE_JS, MAPLIBRE_WORKER, ensureRendererStyle,
  configureRenderer, createSharonMap, loadSharonRenderer
} from '../src/ui/SharonMapRuntime.js';
import { readFile } from 'node:fs/promises';

test('Omgeving and Locaties use one shared MapLibre setup', async () => {
  const environment = await readFile(new URL('../src/ui/EnvironmentMapLibre.js',import.meta.url),'utf8');
  const location = await readFile(new URL('../src/ui/LocationAreaPreview.js',import.meta.url),'utf8');
  assert.match(environment, /from '\.\/SharonMapRuntime\.js\?v=0\.1\.99'/);
  assert.match(location, /from '\.\/SharonMapRuntime\.js\?v=0\.1\.99'/);
  assert.match(environment, /createSharonMap\(library, options\)/);
  assert.match(location, /createSharonMap\(lib, \{/);
  assert.match(location, /loadSharonRenderer\(loadRenderer\)/);
  assert.equal(MAPLIBRE_JS.includes('maplibre-gl@6.11.2'), true);
});

test('stylesheet is injected only once and both maps reuse the ESM worker', async () => {
  let linked = false, calls = 0;
  const fakeDocument = {
    querySelector() { return linked ? { tagName:'LINK' } : null; },
    createElement(tag) { assert.equal(tag, 'link'); return { dataset:{} }; },
    head: { append(node) { calls++; linked = true; assert.equal(node.rel,'stylesheet'); } }
  };
  ensureRendererStyle(fakeDocument);
  ensureRendererStyle(fakeDocument);
  assert.equal(calls,1);
  let worker='', count=0;
  const renderer = {
    Map: class { constructor(options) { this.options = options; } },
    setWorkerUrl(url) { worker=url; },
    setWorkerCount(value) { count=value; }
  };
  assert.equal(configureRenderer(renderer),renderer);
  assert.equal(worker,MAPLIBRE_WORKER);
  assert.equal(count,2);
  const map=createSharonMap(renderer,{test:true});
  assert.equal(map.options.test,true);
  assert.throws(()=>configureRenderer({}), /kaartbibliotheek/i);

  const prev=globalThis.document;
  globalThis.document=fakeDocument;
  try {
    const result=await loadSharonRenderer(async ()=>renderer);
    assert.equal(result,renderer);
  } finally { globalThis.document=prev; }
});
