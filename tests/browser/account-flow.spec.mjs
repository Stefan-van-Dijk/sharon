import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';

let server,base;
const root=resolve('.');
test.beforeAll(async()=>{
 server=createServer((request,response)=>{
  const path=new URL(request.url,'http://local').pathname;
  if(path==='/account-fixture.html'){
   response.setHeader('Content-Type','text/html');
   response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main></main>');return;
  }
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep)||!existsSync(file)){response.writeHead(404).end();return;}
  response.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'text/javascript');
  response.end(readFileSync(file));
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 base='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(done=>server.close(done));});

test('Account registration unlocks app connections and logout restores information boards',async({page},testInfo)=>{
 await page.goto(base+'/account-fixture.html');
 await page.addStyleTag({content:readFileSync('index.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1]});
 // The full shell reserves this space above the sticky module tabs.
 await page.addStyleTag({content:'.sh-apps-view{padding-top:80px}'});
 await page.evaluate(async()=>{
  const {openAppsView}=await import('/src/ui/AppsView.js');
  const records=new Map();
  const store={get:async(_,key)=>records.get(key),put:async(_,row)=>records.set(row.key,row),updateMeta:async(key,update)=>records.set(key,{value:update(records.get(key)?.value)})};
  const device={personId:'BrowserUser1',deviceToken:'d'.repeat(43)};
  let registered=false,verified=false,session=false;
  const account={id:'BrowserAcct1',email:'browser@example.test',personId:device.personId};
  const connection={device:async()=>device,request:async(action,input={})=>{
   if(action==='account-register'){if(window.failAccountMail)throw Error('De e-mailafzender voor Sharon is nog niet ingesteld op de server.');registered=true;return {ok:true};}
   if(action==='account-verify'){if(!registered||input.code!=='test-confirmation')throw Error('Code klopt niet');verified=true;return {ok:true};}
   if(action==='account-login'){
    if(!verified||input.personId!==device.personId||input.deviceToken!==device.deviceToken)throw Error('Toegang geweigerd');
    session=true;return {account,sessionToken:'s'.repeat(43)};
   }
   if(action==='account-logout'){session=false;return {account:null};}
   if(action==='account-status')return {account:session?account:null};
   if(action==='shop-pair-list')return {devices:[]};
   throw Error('Onverwachte actie '+action);
  }};
  const settings={get:()=>({profile:{name:'Browser user'}}),update:async()=>{}};
  openAppsView(document.querySelector('main'),{store,settings,connection,items:[{id:'agenda',title:'Agenda'}]});
 });
 await page.getByRole('button',{name:'Apps verbinden',exact:true}).click();
 const tabs=await page.locator('.sh-apps-tabs').boundingBox();
 const hero=await page.locator('.sh-account-hero').boundingBox();
 expect(hero.y).toBeGreaterThanOrEqual(tabs.y+tabs.height);
 for(const id of ['shoplist','eventline']){
  const followsAppColor=await page.locator('[data-swipe-row="'+id+'"] .sh-strip-icon svg').evaluate(element=>getComputedStyle(element).stroke===getComputedStyle(element.parentElement).color);
  expect(followsAppColor).toBe(true);
 }
 await page.screenshot({path:testInfo.outputPath('account-guest.png')});
 await page.locator('[data-swipe-row="eventline"] [data-swipe-surface]').click();
 let board=page.getByRole('dialog',{name:'Event Line',exact:true});
 await expect(board.getByRole('button',{name:'Verbind Event Line'})).toHaveCount(0);
 await board.getByRole('button',{name:'Sluiten',exact:true}).click();
 await page.getByRole('button',{name:'Account aanmaken',exact:true}).click();
 board=page.getByRole('dialog',{name:'Sharon-account',exact:true});
 await board.getByLabel('E-mailadres',{exact:true}).fill('browser@example.test');
 await board.getByLabel('Wachtwoord',{exact:true}).fill('Een lang testwachtwoord');
 await page.evaluate(()=>{window.failAccountMail=true;});
 await board.getByRole('button',{name:'Account aanmaken',exact:true}).click();
 await expect(board.getByRole('status')).toContainText('De e-mailafzender voor Sharon is nog niet ingesteld');
 const register=board.getByRole('button',{name:'Account aanmaken',exact:true});
 await expect(register).toBeEnabled();
 await expect(register).toHaveCSS('background-color','rgb(103, 59, 210)');
 await expect(register).toHaveCSS('color','rgb(255, 255, 255)');
 await page.evaluate(()=>{window.failAccountMail=false;});
 await register.click();
 await expect(board.getByRole('button',{name:'Bevestig e-mailadres',exact:true})).toBeVisible();
 await board.getByLabel('Code uit je e-mail').fill('test-confirmation');
 await board.getByRole('button',{name:'Bevestig e-mailadres',exact:true}).click();
 await board.getByLabel('Wachtwoord',{exact:true}).fill('Een lang testwachtwoord');
 await board.getByRole('button',{name:'Inloggen',exact:true}).click();
 await expect(board).toHaveCount(0);
 await expect(page.locator('.sh-account-controls')).toContainText('browser@example.test');
 await page.screenshot({path:testInfo.outputPath('account-connected.png')});
 await page.locator('[data-swipe-row="eventline"] [data-swipe-surface]').click();
 board=page.getByRole('dialog',{name:'Event Line',exact:true});
 await board.getByRole('button',{name:'Verbind Event Line',exact:true}).click();
 await expect(board.getByRole('button',{name:'Open Event Line',exact:true})).toBeVisible();
 await board.getByRole('button',{name:'Sluiten',exact:true}).click();
 const surface=page.locator('[data-swipe-row="eventline"] [data-swipe-surface]');
 const box=await surface.boundingBox();
 await page.mouse.move(box.x+box.width*.7,box.y+box.height/2);
 await page.mouse.down();await page.mouse.move(box.x+box.width*.7-105,box.y+box.height/2,{steps:8});await page.mouse.up();
 await expect(page.locator('[data-swipe-row="eventline"] [data-swipe-delete]')).toBeVisible();
 await page.getByRole('button',{name:'Uitloggen',exact:true}).click();
 await page.locator('[data-swipe-row="eventline"] [data-swipe-surface]').click();
 board=page.getByRole('dialog',{name:'Event Line',exact:true});
 await expect(board.getByRole('button',{name:'Open Event Line',exact:true})).toHaveCount(0);
 await expect(board.getByRole('button',{name:'Verbind Event Line',exact:true})).toHaveCount(0);
 const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 expect(horizontalOverflow).toBe(false);
});
