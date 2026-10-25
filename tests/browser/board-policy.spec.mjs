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
      const touch=new Touch({identifier:1,target,clientX:x,clientY:300});
      target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
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
