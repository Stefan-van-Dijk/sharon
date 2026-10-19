import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

// Runs unmodified packaged modules in an isolated DOM and IndexedDB per test.
// This is a DOM integration test, not a rendering, real GPS or service-worker test.
export async function appHarness({ root = resolve('_site'), demo = false, storageFailure = false, firstRun = false } = {}) {
  const errors = [], requests = [], gps = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://test.invalid/sharon/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window, context = dom.getInternalVMContext();
  Object.defineProperty(w, 'crypto', { value: webcrypto });
  w.structuredClone = structuredClone;
  w.indexedDB = storageFailure ? { open() { throw new Error('Opslag geblokkeerd'); } } : new IDBFactory();
  w.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.fetch = async url => { requests.push(String(url)); throw new TypeError('Offline'); };
  Object.defineProperty(w.navigator, 'onLine', { value: false });
  Object.defineProperty(w.navigator, 'geolocation', { value: { getCurrentPosition(_success, fail, options) {
    gps.push(options); queueMicrotask(() => fail({ code: 1, message: 'GPS geweigerd' }));
  } } });
  // Skip waiting for visual animations; their duration/layout is a manual test.
  const timeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...args) => timeout(fn, (ms >= 60_000 ? ms : Math.min(ms, 5)), ...args);
  const modules = new Map();
  function getModule(url) {
    const key = url.href;
    if (modules.has(key)) return modules.get(key);
    const path = resolve(root, '.' + url.pathname.replace(/^\/sharon/, ''));
    if (!path.startsWith(resolve(root) + sep)) throw Error('Module buiten artifact');
    const module = new vm.SourceTextModule(readFileSync(path, 'utf8'), { context, identifier: key,
      initializeImportMeta(meta) { meta.url = key; },
      importModuleDynamically: async (spec, parent) => {
        const child = getModule(new URL(spec, parent.identifier));
        if (child.status === 'unlinked') await child.link(linker);
        if (child.status === 'linked') await child.evaluate();
        return child;
      } });
    modules.set(key, module); return module;
  }
  function linker(spec, parent) {
    if (!spec.startsWith('.')) throw Error(`Extern moduleverzoek: ${spec}`);
    return getModule(new URL(spec, parent.identifier));
  }
  async function load(spec) {
    const module = getModule(new URL(spec, w.location.href));
    if (module.status === 'unlinked') await module.link(linker);
    if (module.status === 'linked') await module.evaluate();
    return module.namespace;
  }
  let store;
  if (!storageFailure) {
    const { ObjectStore } = await load('./src/core/storage/ObjectStore.js?v=0.3.61');
    store = await new ObjectStore().open();
    if (!firstRun) await store.put('settings', { key: 'app', value: { profile: { name: 'Testgebruiker' }, onboarding: { storySeen: true } } });
    await store.put('objects', { id: 'TestPlace001', type: 'location', data: { title: 'Persoonlijke plek', kind: 'other', address: {} } });
    await store.put('meta', { key: 'skeleton.demo.enabled', value: demo });
  }
  return { window: w, document: w.document, errors, requests, gps, store, load,
    boot() {
      const entry = w.document.querySelector('script[type="module"][src]');
      if (!entry) throw Error('Module-entry ontbreekt');
      return load(entry.getAttribute('src'));
    },
    close() { dom.window.close(); } };
}
export async function until(check, message = 'DOM niet gereed') {
  for (let i = 0; i < 200; i++) {
    const result = await check(); if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error(message);
}
