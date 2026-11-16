import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
let server,base;
const root=resolve('.');
const styles=readFileSync('index.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
test.beforeAll(async()=>{
 server=createServer((req,res)=>{
  const name=new URL(req.url,'http://local').pathname;
  if(name==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><button id="launch">Apps</button>');return;}
  const file=resolve(root,'.'+name);
  if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/javascript');res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{if(server)await new Promise(r=>server.close(r));});
async function openPairing(page,{pending=false}={}){
 await page.goto(base+'/fixture.html');await page.addStyleTag({content:styles});
 await page.evaluate(async pending=>{
  const {openShopPairing}=await import('/src/ui/ShopPairing.js');
  document.querySelector('#launch').focus();
  window.requests=0;window.stopPairing=openShopPairing({store:{get:async(_,key)=>JSON.parse(localStorage.getItem(key)||'null'),put:async(_,record)=>localStorage.setItem(record.key,JSON.stringify(record))},device:async()=>({}),request:async()=>{window.requests++;if(pending)return new Promise(resolve=>window.finishPairing=resolve);return {devices:Array.from({length:12},(_,i)=>({id:'device'+i,status:'active',fingerprint:'TEST '+i}))};}});
 },pending);
}
async function drag(page,target,dy){
 const box=await target.boundingBox();const x=box.x+box.width*.45,y=box.y+Math.min(box.height/2,20);
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+dy,{steps:8});await page.mouse.up();
}
test('connection board stays within viewport and can close while its server request is pending',async({page})=>{
 await openPairing(page,{pending:true});
 const dialog=page.locator('.sh-shop-access'),surface=dialog.locator('.sh-shop-access-board'),close=dialog.locator('[data-shop-close]');
 await expect(close).toHaveCount(0);const box=await surface.boundingBox(),viewport=page.viewportSize();
 expect(box.width).toBeGreaterThan(250);expect(box.height).toBeGreaterThan(250);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
 await drag(page,dialog.locator('h2'),100);await expect(dialog).toHaveCount(0);await expect(page.locator('#launch')).toBeFocused();
 await page.evaluate(()=>{window.finishPairing({devices:[]});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.requests)).toBe(1);
});
test('connection board keeps scrolling inside content and closes on a downward media swipe',async({page})=>{
 await openPairing(page);
 const dialog=page.locator('.sh-shop-access'),media=dialog.locator('[data-card-media]'),content=dialog.locator('.sh-shop-access-content'),grab=dialog.locator('[data-deck-grab]');
 await expect(dialog.locator('.sh-notes-body')).toContainText('TEST 11');
 expect(await media.evaluate(el=>getComputedStyle(el).touchAction)).toBe('none');
 expect(await grab.evaluate(el=>getComputedStyle(el).position)).toBe('absolute');
 expect(await content.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await content.evaluate(el=>{el.scrollTop=120;});expect(await content.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);await expect(dialog).toBeVisible();
 await drag(page,dialog.locator('h2'),100);await expect(dialog).toHaveCount(0);
});

test('app board and media resize independently without closing the board',async({page})=>{
 await openPairing(page);
 const dialog=page.locator('.sh-shop-access'),surface=dialog.locator('.sh-shop-access-board'),media=dialog.locator('[data-card-media]');
 const before=await surface.boundingBox();await drag(page,dialog.locator('[data-deck-size="board"]'),80);
 expect((await surface.boundingBox()).height).toBeLessThan(before.height-30);
 const picture=await media.boundingBox();await drag(page,dialog.locator('[data-deck-size="media"]'),-40);
 expect((await media.boundingBox()).height).toBeLessThan(picture.height-15);await expect(dialog).toBeVisible();
});

test('connection board keeps its moved position and sizes after reopening and status refresh',async({page})=>{
 await openPairing(page);
 const surface=page.locator('.sh-shop-access-board'),media=page.locator('.sh-shop-access [data-card-media]');
 await drag(page,page.locator('[data-deck-size="board"]'),80);
 await drag(page,page.locator('[data-deck-size="media"]'),-35);
 const grab=page.locator('[data-deck-grab]'),box=await grab.boundingBox();
 await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+55,box.y+box.height/2,{steps:4});
 await page.mouse.move(box.x+55,box.y+box.height/2-45,{steps:6});await page.mouse.up();
 const before=await surface.boundingBox(),picture=await media.boundingBox();
 await page.waitForFunction(()=>localStorage.getItem('apps.shoplist.board.layout'));
 await page.evaluate(()=>window.stopPairing());await openPairing(page);
 await expect.poll(async()=>Math.abs((await surface.boundingBox()).y-before.y)).toBeLessThan(2);
 expect(Math.abs((await surface.boundingBox()).height-before.height)).toBeLessThan(2);
 expect(Math.abs((await media.boundingBox()).height-picture.height)).toBeLessThan(2);
 await page.getByRole('button',{name:'Vernieuwen',exact:true}).click();
 expect(Math.abs((await surface.boundingBox()).y-before.y)).toBeLessThan(2);
 expect(Math.abs((await surface.boundingBox()).height-before.height)).toBeLessThan(2);
});
