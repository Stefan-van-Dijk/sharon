import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
const version=JSON.parse(readFileSync('package.json')).version;
let server,base;
test.beforeAll(async()=>{
  const root=resolve('_site');
  server=createServer((req,res)=>{
    const path=new URL(req.url,'http://local').pathname;
    if(path==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Board test</title>');return;}
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server)await new Promise(r=>server.close(r));});
async function open(page,owner=true){
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/fixture.html');
  await page.evaluate(async({version,owner})=>{
    const {ObjectStore}=await import('/src/core/storage/ObjectStore.js?v='+version);
    const {InformationFeedbackService}=await import('/src/core/information/InformationFeedbackService.js?v='+version);
    const {openBoardViewer}=await import('/src/ui/BoardViewer.js?v='+version);
    const store=await new ObjectStore().open();
    new InformationFeedbackService(store,{device:async()=>({personId:'abcdefghijkl',self:{line:owner?0:1}}),request:async()=>{throw Error('Offline fixture');}}).start(window);
    window.nextCount=0;
    window.closeBoard=openBoardViewer({id:'Q42',geometry:{coordinates:[5,52]},properties:{wikidata:'Q42',title:'Testboard',url:'https://nl.wikipedia.org/?curid=42'}},{onNext:()=>window.nextCount++});
  },{version,owner});
  await expect(page.getByRole('button',{name:'Vind ik leuk',exact:true})).toBeEnabled();
  if(owner)await expect(page.locator('[data-policy-swipe]')).toHaveCount(1);
}
async function swipe(page,selector,dx=-130){
  await page.locator(selector).evaluate((target,dx)=>{
    for(const [type,x] of [['touchstart',220],['touchmove',220+dx],['touchend',220+dx]]){
      // WebKit exposes Touch but does not allow constructing it.
      const touch={identifier:1,target,clientX:x,clientY:300};
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[touch]},changedTouches:{value:[touch]}});
      target.dispatchEvent(event);
    }
  },dx);
}
test('footer swipe stays on board; Escape dismisses editor only; close removes editor',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await open(page);
  await swipe(page,'.sh-board-footer');
  await expect(page.getByRole('dialog',{name:'Relevantie beheren',exact:true})).toBeVisible();
  await page.waitForTimeout(300); // Allow an erroneous deck navigation timer to fire.
  expect(await page.evaluate(()=>window.nextCount)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sh-board-owner-policy-overlay')).toHaveCount(0);
  await expect(page.locator('.sh-board-overlay')).toHaveCount(1);
  await swipe(page,'.sh-board-footer');
  await page.evaluate(()=>window.closeBoard());
  await expect(page.locator('.sh-board-owner-policy-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('non-owner cannot open relevance management',async({page})=>{
  await open(page,false);await swipe(page,'.sh-board-footer');
  await expect(page.locator('.sh-board-owner-policy-overlay')).toHaveCount(0);
});

test('shared card shows online status and clears it when the temporary QR file disappears',async({page})=>{
  await open(page);
  let remote=null,uploads=0;
  await page.route('https://sharon.life/log/api/connections.php',async route=>{
    const input=route.request().postDataJSON();
    if(input.action==='share-publish'){
      remote=input;uploads++;await route.fulfill({status:200,json:{ok:true}});
    }else if(input.action==='share-read'){
      await route.fulfill(remote?{status:200,json:{payload:remote.payload}}:{status:410,json:{error:'share_unavailable'}});
    }else await route.abort();
  });
  await page.evaluate(async version=>{
    window.closeBoard();
    const {ObjectStore}=await import('/src/core/storage/ObjectStore.js?v='+version);
    const {openCardsView}=await import('/src/ui/CardsView.js?v='+version);
    const store=await new ObjectStore().open();
    await store.put('objects',{id:'PrivateCard1',type:'card',name:'Testpas',cardKind:'loyalty',codeFormat:'',codeValue:'',fields:[]});
    const root=document.createElement('main');const headerActions=document.createElement('div');document.body.append(headerActions,root);
    await openCardsView(root,{store,location:{latest:null},events:{on:()=>()=>{},emit(){}},setTitle(){},headerActions});
  },version);
  await page.locator('[data-swipe-share]').click();
  await page.getByRole('button',{name:'Deel via korte QR',exact:true}).click();
  await expect(page.locator('[data-share-qr-code] svg')).toBeVisible();
  await expect(page.locator('[data-sharing-state="online"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Sluiten',exact:true}).click();
  await page.locator('[data-swipe-share]').click();
  await page.getByRole('button',{name:'Toon gedeelde QR',exact:true}).click();
  await expect(page.locator('[data-share-qr-code] svg')).toBeVisible();
  expect(uploads).toBe(1);
  await page.getByRole('button',{name:'Sluiten',exact:true}).click();
  remote=null;
  await page.locator('[data-swipe-share]').click();
  await expect(page.locator('[data-sharing-state="offline"]')).toHaveCount(1);
  await expect(page.locator('[data-sharing-details]')).toContainText('opgehaald of verwijderd');
  expect(uploads).toBe(1);
});
