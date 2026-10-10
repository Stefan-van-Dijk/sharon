import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('a navigation with the current version bypasses cached HTML and reloads HTTP cache', async () => {
  const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  const listeners = new Map(); let requestOptions, cacheLookups = 0, responsePromise;
  vm.runInNewContext(source, { URL,
    self: { location: { origin: 'https://example.com' }, addEventListener: (name, fn) => listeners.set(name, fn) },
    caches: { match: async () => { cacheLookups++; return 'old HTML'; },
      open: async () => ({ put: async () => {} }) },
    fetch: async (_, options) => { requestOptions = options; return { ok: true, clone: () => ({}) }; }
  });
  listeners.get('fetch')({ request: { method: 'GET', mode: 'navigate',
    url: 'https://example.com/sharon/?v=0.1.63' }, respondWith: promise => responsePromise = promise });
  await responsePromise;
  assert.equal(cacheLookups, 0);
  assert.equal(requestOptions.cache, 'reload');
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
    { now: () => 0 }, async () => ({ start: async () => calls.push('intro') }));
  assert.equal(calls[0], 'register');
  assert.ok(calls.includes('update'));
});
