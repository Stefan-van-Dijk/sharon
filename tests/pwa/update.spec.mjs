import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, cpSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSite } from '../../scripts/build-site.mjs';

let server, base, root, current, next, legacy, serving, fault = '';
test.beforeAll(async () => {
  root = mkdtempSync(resolve('.pwa-test-'));
  current = resolve('_site');
  const source = join(root, 'next'); mkdirSync(source);
  for (const name of ['src','assets','vendor','index.html','manifest.webmanifest','service-worker.js','scripts','package.json','package-lock.json','tests/helpers','tests/integration']) {
    mkdirSync(resolve(source, name, '..'), {recursive:true}); cpSync(name, join(source, name), {recursive:true});
  }
  execFileSync(process.execPath, ['scripts/set-version.mjs', '0.3.57'], {cwd:source});
  buildSite(source); next = join(source, '_site');
  legacy = join(root,'legacy'); mkdirSync(legacy);
  const archive = execFileSync('git',['archive','fb9761ab6b22bb803c24da46131751868cd8d8cf','src','assets','vendor','index.html','manifest.webmanifest','service-worker.js']);
  execFileSync('tar',['-x','-C',legacy],{input:archive});
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://local');
    let path = decodeURIComponent(url.pathname).replace(/^\/sharon\//,'');
    if (!path) path = 'index.html';
    const file = resolve(serving,path);
    if (!file.startsWith(serving + sep) || !existsSync(file)) {res.writeHead(404).end(); return;}
    const types={js:'text/javascript',html:'text/html',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'};
    res.setHeader('Content-Type',types[path.split('.').at(-1)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    if (serving === next && path === 'src/core/storage/ObjectStore.js' && fault) {
      if (fault === 'interrupted') { res.destroy(); return; }
      if (fault === 'missing') { res.writeHead(503).end('onderbroken update'); return; }
      if (fault === 'hash') { res.end('export const unexpected = true;'); return; }
    }
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}/sharon/`;
});
test.afterAll(async () => {
  if(server) await new Promise(resolve => server.close(resolve));
  if(root) rmSync(root,{recursive:true,force:true});
});
test.beforeEach(async ({context}) => {
  serving = current; fault = '';
  await context.addInitScript(() => {
    Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(_ok,fail){queueMicrotask(()=>fail({code:1,message:'Test: GPS geweigerd'}));}}});
  });
});
async function install(page, version='0.3.56') {
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.evaluate(async () => {
    const db = await new Promise((resolve,reject)=>{const r=indexedDB.open('sharon');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['settings','objects'],'readwrite');
      tx.objectStore('settings').put({key:'app',value:{profile:{name:'PWA-test'},onboarding:{storySeen:true}}});
      tx.objectStore('objects').put({id:'UpgradeCard1',type:'card',name:'Behouden pas'});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  });
  await page.reload();
  await expect(page.locator('.app-version')).toHaveText('v'+version);
}
async function update(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return new Promise((resolve,reject)=>{
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker.addEventListener('statechange',()=>{if(['installed','redundant'].includes(worker.state))resolve(worker.state);});
      },{once:true});
      registration.update().catch(reject);
    });
  });
}
async function storedCard(page) {
  return page.evaluate(async () => {
    const db=await new Promise(resolve=>{const r=indexedDB.open('sharon');r.onsuccess=()=>resolve(r.result);});
    const value=await new Promise(resolve=>{const r=db.transaction('objects').objectStore('objects').get('UpgradeCard1');r.onsuccess=()=>resolve(r.result);});
    db.close();return value;
  });
}

test('complete update waits for both tabs, preserves a draft and data, then boots offline', async ({page,context}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await install(page);
  const second=await context.newPage();await second.goto(base);
  await page.locator('[data-module="cards"]').click();
  await page.getByRole('button',{name:'Kaart toevoegen',exact:true}).click();
  await page.getByRole('textbox',{name:'Naam van de kaart',exact:true}).fill('Niet verliezen');
  serving=next;
  expect(await update(page)).toBe('installed');
  await expect(second.locator('[data-update-notice]')).toContainText('Sluit alle Sharon-vensters');
  await expect(page.getByRole('textbox',{name:'Naam van de kaart',exact:true})).toHaveValue('Niet verliezen');
  await second.reload();await expect(second.locator('.app-version')).toHaveText('v0.3.56');
  await second.close();
  expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
  await page.close();await context.setOffline(true);
  const reopened=await context.newPage();await reopened.goto(base);
  await expect(reopened.locator('.app-version')).toHaveText('v0.3.57');
  expect((await storedCard(reopened)).name).toBe('Behouden pas');
  // Local generators/scanner are in the complete offline closure; external maps are not.
  expect(await reopened.evaluate(async()=>{
    const codes=await import('./src/ui/CardCodes.js?v=0.3.57');
    await codes.loadCardGenerator('QR_CODE');await codes.loadCardScanner();return !!globalThis.qrcode && !!globalThis.ZXing;
  })).toBe(true);
  expect(errors).toEqual([]);
});
for (const failure of ['missing','interrupted','hash']) test(`failed ${failure} update retains the old offline release`, async ({page,context}) => {
  await install(page);
  const names=await page.evaluate(()=>caches.keys());
  serving=next;fault=failure;
  expect(await update(page)).toBe('redundant');
  expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
  expect(await page.evaluate(()=>caches.keys())).toEqual(names);
  await context.setOffline(true);await page.reload();
  await expect(page.locator('.app-version')).toHaveText('v0.3.56');
  expect((await storedCard(page)).name).toBe('Behouden pas');
});
test('migration from the published 0.3.55 retains private data on offline restart', async ({page,context}) => {
  serving=legacy;await install(page,'0.3.55');
  serving=current;expect(await update(page)).toBe('installed');
  await page.close();await context.setOffline(true);
  const reopened=await context.newPage();await reopened.goto(base);
  await expect(reopened.locator('.app-version')).toHaveText('v0.3.56');
  expect((await storedCard(reopened)).name).toBe('Behouden pas');
});
test('an explicit server rollback is staged and preserves data', async ({page,context}) => {
  serving=next;await install(page,'0.3.57');
  serving=current;expect(await update(page)).toBe('installed');
  await page.close();await context.setOffline(true);
  const reopened=await context.newPage();await reopened.goto(base);
  await expect(reopened.locator('.app-version')).toHaveText('v0.3.56');
  expect((await storedCard(reopened)).name).toBe('Behouden pas');
});

test('an evicted module is repaired only with matching bytes from the same release', async ({page}) => {
  await install(page);
  await page.evaluate(async () => {
    for(const key of await caches.keys()) if(key.startsWith('sharon-shell-')) {
      await (await caches.open(key)).delete(new URL('./src/ui/Brand.js?v=0.3.56',location.href));
    }
  });
  await page.reload();await expect(page.locator('.app-version')).toHaveText('v0.3.56');
  expect((await storedCard(page)).name).toBe('Behouden pas');
});
