import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, cpSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSite } from '../../scripts/build-site.mjs';

const currentVersion = JSON.parse(readFileSync('package.json')).version;
const nextVersion = currentVersion.replace(/\d+$/, value => Number(value) + 1);

let server, base, root, current, next, legacy, serving, fault = '';
test.beforeAll(async () => {
  root = mkdtempSync(resolve('.pwa-test-'));
  current = resolve('_site');
  const source = join(root, 'next'); mkdirSync(source);
  for (const name of ['src','assets','vendor','index.html','manifest.webmanifest','service-worker.js','scripts','package.json','package-lock.json','tests/helpers','tests/integration']) {
    mkdirSync(resolve(source, name, '..'), {recursive:true}); cpSync(name, join(source, name), {recursive:true});
  }
  execFileSync(process.execPath, ['scripts/set-version.mjs', nextVersion], {cwd:source});
  buildSite(source); next = join(source, '_site');
  legacy = join(root,'legacy'); mkdirSync(legacy);
  const archive = execFileSync('git',['archive','fb9761ab6b22bb803c24da46131751868cd8d8cf','src','assets','vendor','index.html','manifest.webmanifest','service-worker.js'], {maxBuffer:16*1024*1024});
  execFileSync('tar',['-x','-C',legacy],{input:archive});
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://local');
    let path = decodeURIComponent(url.pathname).replace(/^\/sharon\//,'');
    if (!path) path = 'index.html';
    if (path === 'test-setup.html') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Fictieve PWA-testgegevens</title>');return;}
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
async function install(page, version=currentVersion) {
  await page.goto(base+'test-setup.html');
  await page.evaluate(async version => {
    const {ObjectStore}=await import('./src/core/storage/ObjectStore.js?v='+version);
    const store=await new ObjectStore().open();
    await store.put('settings',{key:'app',value:{profile:{name:'PWA-test'},onboarding:{storySeen:true}}});
    await store.put('objects',{id:'UpgradeCard1',type:'card',name:'Behouden pas'});
  },version);
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
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
  await second.setViewportSize({width:390,height:844});
  await page.locator('[data-module="cards"]').click();
  await page.getByRole('button',{name:'Kaart toevoegen',exact:true}).click();
  await page.getByRole('combobox',{name:'Naam van de kaart',exact:true}).fill('Niet verliezen');
  serving=next;
  expect(await update(page)).toBe('installed');
  await expect(second.locator('[data-update-notice]')).toContainText('Sluit alle Sharon-vensters');
  await expect(page.getByRole('combobox',{name:'Naam van de kaart',exact:true})).toHaveValue('Niet verliezen');
  await second.reload();await expect(second.locator('.app-version')).toHaveText('v'+currentVersion);
  await second.close();
  expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
  await page.close();await context.setOffline(true);
  const reopened=await context.newPage();await reopened.goto(base);
  await expect(reopened.locator('.app-version')).toHaveText('v'+nextVersion);
  expect((await storedCard(reopened)).name).toBe('Behouden pas');
  // Local generators/scanner are in the complete offline closure; external maps are not.
  expect(await reopened.evaluate(async version=>{
    const codes=await import('./src/ui/CardCodes.js?v='+version);
    await codes.loadCardGenerator('QR_CODE');await codes.loadCardScanner();return !!globalThis.qrcode && !!globalThis.ZXing;
  },nextVersion)).toBe(true);
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
  await expect(page.locator('.app-version')).toHaveText('v'+currentVersion);
  expect((await storedCard(page)).name).toBe('Behouden pas');
});
test('migration from the published 0.3.55 retains private data on offline restart', async ({page,context}) => {
  serving=legacy;await install(page,'0.3.55');
  serving=current;expect(await update(page)).toBe('installed');
  await page.close();await context.setOffline(true);
  const reopened=await context.newPage();await reopened.goto(base);
  await expect(reopened.locator('.app-version')).toHaveText('v'+currentVersion);
  expect((await storedCard(reopened)).name).toBe('Behouden pas');
});
test('an explicit server rollback is staged and preserves data', async ({page,context}) => {
  serving=next;await install(page,nextVersion);
  serving=current;expect(await update(page)).toBe('installed');
  await page.close();await context.setOffline(true);
  const reopened=await context.newPage();await reopened.goto(base);
  await expect(reopened.locator('.app-version')).toHaveText('v'+currentVersion);
  expect((await storedCard(reopened)).name).toBe('Behouden pas');
});

test('an evicted module is repaired only with matching bytes from the same release', async ({page}) => {
  await install(page);
  await page.evaluate(async version => {
    for(const key of await caches.keys()) if(key.startsWith('sharon-shell-')) {
      await (await caches.open(key)).delete(new URL('./src/ui/Brand.js?v='+version,location.href));
    }
  },currentVersion);
  await page.reload();await expect(page.locator('.app-version')).toHaveText('v'+currentVersion);
  expect((await storedCard(page)).name).toBe('Behouden pas');
});


test('Home scroll and module return keep header, brand, status and boards in place', async ({page}) => {
  await page.setViewportSize({width:390,height:600});
  await install(page);
  const header = page.locator('[data-app-header]');
  const outlet = page.locator('[data-view-outlet]');
  const positions = () => page.evaluate(() =>
    ['[data-app-header]', '[data-brand-control]', '[data-location-status]', '[data-home-board-stack]']
      .map(selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return {x:box.x, y:box.y, width:box.width, height:box.height};
      }));
  const before = await positions();
  await outlet.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => outlet.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  // A native wheel gesture must also stay with the content, including at its edge.
  await outlet.hover();
  await page.mouse.wheel(0, 800);
  await page.evaluate(() => window.scrollTo(0, 800));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const after = await positions();
  after.forEach((box, index) => {
    expect(box.x).toBeCloseTo(before[index].x, 1);
    expect(box.y).toBeCloseTo(before[index].y, 1);
    expect(box.height).toBeCloseTo(before[index].height, 1);
  });
  await outlet.evaluate(element => { element.scrollTop = 0; });
  await page.locator('[data-module="cards"]').click();
  await expect(header).toHaveClass(/is-detail/);
  await expect(header).toHaveCSS('position', 'fixed');
  await page.locator('[data-brand-control]').click();
  await expect(page.locator('[data-app-stage]')).toHaveAttribute('data-view', 'home');
  await expect(outlet).not.toHaveClass(/is-changing/);
  await expect(header).toHaveCSS('min-height', '92px');
  await expect.poll(async () => (await header.boundingBox()).height).toBeCloseTo(before[0].height, 1);
  await outlet.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const returned = await positions();
  returned.forEach((box, index) => expect(box.y).toBeCloseTo(before[index].y, 1));
  await page.setViewportSize({width:390,height:844});
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-app-stage]').getBoundingClientRect().height)).toBe(844);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const top = (await header.boundingBox()).y;
  await outlet.evaluate(element => { element.scrollTop = 0; });
  expect((await header.boundingBox()).y).toBeCloseTo(top, 1);
});

test('Personen rows stay opaque while returning from chat and do not expose their swipe actions',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('https://sharon.life/log/api/connections.php',async route=>{
    const input=route.request().postDataJSON();
    if(input.action==='contacts')await new Promise(resolve=>setTimeout(resolve,400));
    await route.fulfill({json:input.action==='contacts'?{contacts:[{personId:'Peer00000001',chatId:'Chat00000001',name:'Contact'}]}:{messages:[]}});
  });
  await install(page);
  await page.evaluate(async version=>{
    const {ObjectStore}=await import('./src/core/storage/ObjectStore.js?v='+version);
    const {ConnectionService}=await import('./src/core/connection/ConnectionService.js?v='+version);
    const store=await new ObjectStore().open(),service=new ConnectionService(store),device=await service.device();
    await service.rememberSelf({personId:device.personId,networkId:'Network00001',line:0});
    await store.setMeta('connection.contacts.log-json.v1',[{personId:'Peer00000001',chatId:'Chat00000001',name:'Contact'}]);
  },currentVersion);
  await page.reload();
  await page.locator('[data-module="people"]').click();
  const surface=page.locator('[data-contacts] [data-swipe-surface]').first();
  await expect(surface).toBeVisible();await expect(surface).toHaveCSS('opacity','1');
  await expect(surface).toBeEnabled();await surface.click();
  await expect(page.locator('[data-message-form]')).toBeVisible();
  await expect(page.locator('[data-navigation-back]')).toBeEnabled();
  await page.locator('[data-navigation-back]').click();
  await expect(surface).toBeVisible();await expect(surface).toBeDisabled();
  await expect(surface).toHaveCSS('opacity','1');
  await expect(surface).toBeEnabled();await expect(surface).toHaveCSS('opacity','1');
});

test('card and location strips cover their actions at rest on a narrow screen',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await install(page);
 await page.evaluate(async version=>{
  const {ObjectStore}=await import('./src/core/storage/ObjectStore.js?v='+version);const store=await new ObjectStore().open();
  await store.put('objects',{id:'UiPlace00001',type:'location',data:{title:'Voorbeeldlocatie',address:{text:'Straat 1'},coordinates:{lat:52,lng:5}}});
 },currentVersion);
 for(const module of ['cards','locations']){
  if(module==='locations'){await page.reload();}
  await page.locator('[data-module="'+module+'"]').click();
  const row=page.locator('.sh-object-strip[data-shareable]').first();await expect(row).toBeVisible();
  const geometry=await row.evaluate(row=>{
   const surface=row.querySelector('[data-swipe-surface]'),share=row.querySelector('[data-swipe-share]');
   const r=row.getBoundingClientRect(),s=surface.getBoundingClientRect();
   return {position:getComputedStyle(share).position,opacity:getComputedStyle(share).opacity,top:Math.abs(s.top-r.top),gap:r.height-s.height,
    covered:[r.left+12,r.right-12].every(x=>document.elementFromPoint(x,s.top+s.height/2)?.closest('[data-swipe-surface]')===surface)};
  });
  expect(geometry.position).toBe('absolute');expect(geometry.opacity).toBe('0');expect(geometry.top).toBeLessThanOrEqual(1);expect(geometry.gap).toBeLessThanOrEqual(2);expect(geometry.covered).toBe(true);
  await page.screenshot({path:testInfo.outputPath(module+'-strips.png')});
 }
});
