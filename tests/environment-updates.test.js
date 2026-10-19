import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('a navigation stays in its complete installed release, even while online', async () => {
  const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  const listeners = new Map(); let networkCalls = 0, cacheLookups = 0, responsePromise;
  vm.runInNewContext(source, { URL,
    self: { registration: {scope:'https://example.com/sharon/'}, addEventListener: (name, fn) => listeners.set(name, fn) },
    caches: { open: async () => ({ match: async () => { cacheLookups++; return 'installed HTML'; } }) },
    fetch: async () => { networkCalls++; return 'new HTML'; }
  });
  listeners.get('fetch')({ request: { method: 'GET', mode: 'navigate',
    url: 'https://example.com/sharon/?v=0.1.82' }, respondWith: promise => responsePromise = promise });
  assert.equal(await responsePromise, 'installed HTML');
  assert.equal(cacheLookups, 1);
  assert.equal(networkCalls, 0);
});

test('service worker registration still happens if the page loaded before the intro finished', async () => {
  const source = (await readFile(new URL('../src/main.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
  const calls = [];
  const registration = { update: async () => calls.push('update') };
  const fn = new Function('navigator', 'document', 'window', 'performance', 'createApp',
    `return (async () => { ${source} })()`);
  await fn({ serviceWorker: { register: async () => { calls.push('register'); return registration; } } },
    { readyState: 'complete', querySelector: () => ({}) },
    { addEventListener: () => assert.fail('load already fired') },
    { now: () => 0 }, async () => ({ services: {install: { watchUpdates: () => calls.push('watch') }}, start: async () => calls.push('intro') }));
  assert.equal(calls[0], 'register');
  assert.ok(calls.includes('update'));
});
