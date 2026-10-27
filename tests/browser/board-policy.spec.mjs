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

test('sharing opens QR automatically, reuses it and supports touch dragging and centered edge handles',async({page,browserName})=>{
  await open(page);
  const statusStyles=[...readFileSync('index.html','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
  await page.addStyleTag({content:statusStyles});
  let remote=null,uploads=0;
  await page.route('https://sharon.life/log/api/connections.php',async route=>{
    const input=route.request().postDataJSON();
    if(input.action==='share-publish'){
      remote=input;uploads++;await route.fulfill({status:200,json:{ok:true}});
    }else if(input.action==='share-read'){
      await route.fulfill(remote?{status:200,json:{payload:remote.payload}}:{status:410,json:{error:'share_unavailable'}});
    }else if(input.action==='share-ack'){if(remote?.id===input.id)remote=null;await route.fulfill({status:200,json:{ok:true}});}else await route.abort();
  });
  await page.evaluate(async version=>{
    window.closeBoard();
    const {ObjectStore}=await import('/src/core/storage/ObjectStore.js?v='+version);
    const {openCardsView}=await import('/src/ui/CardsView.js?v='+version);
    const store=await new ObjectStore().open();
    await store.setMeta('connection.contacts.log-json.v1',[{personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna'},...Array.from({length:8},(_,i)=>({personId:'PersonTest0'+i,chatId:'ChatTest000'+i,name:'Persoon '+i}))]);
    await store.put('objects',{id:'PrivateHome1',type:'location',data:{title:'Winkel',coordinates:{lat:52,lng:5}}});
    await store.put('objects',{id:'PrivateCard1',type:'card',name:'Testpas met een langere titel',color:'#d12b54',locationId:'PrivateHome1',cardKind:'loyalty',codeFormat:'',codeValue:'',fields:[]});
    const root=document.createElement('main');const headerActions=document.createElement('div');document.body.append(headerActions,root);
    await openCardsView(root,{store,location:{latest:null},events:{on:()=>()=>{},emit(){}},setTitle(){},headerActions});
  },version);
  await page.evaluate(()=>{window.shareTearSeen=false;document.addEventListener('animationstart',e=>{if(e.animationName==='sh-share-ticket-tear')window.shareTearSeen=true;});});
  await page.locator('[data-swipe-share]').evaluate(button=>button.click());
  await expect(page.locator('[data-share-qr-code] svg')).toBeVisible();
  await expect(page.locator('[data-qr-status]')).toContainText('Deling 7 dagen geldig');
  await expect.poll(()=>page.locator('.sh-share-board-info').evaluate(el=>el.scrollTop)).toBeGreaterThan(40);
  await expect(page.locator('.sh-share-board-info')).toHaveCSS('border-top-style','dashed');
  expect(await page.evaluate(()=>window.shareTearSeen)).toBe(true);
  await page.locator('.sh-share-board-info').evaluate(el=>el.scrollTop=0);

  await expect(page.locator('[data-share-person-panel]')).toBeVisible();
  await expect(page.locator('[data-share-person-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-deck-grab] svg')).toHaveCount(0);
  await expect(page.locator('.sh-share-side-left')).toHaveCSS('writing-mode','vertical-rl');
  await expect(page.locator('[data-share-person-panel]')).toBeVisible();
  await expect(page.locator('[data-sharing-state="online"]')).toHaveCount(1);
  const dot=page.locator('.sh-sharing-dot');
  await expect(dot).toHaveText('');
  await expect(dot).toHaveCSS('width','9px');
  await expect(dot).toHaveCSS('height','9px');
  await expect(dot).toHaveCSS('background-color','rgb(73, 209, 125)');
  await expect(dot).toHaveCSS('left','10px');
  await expect(dot).toHaveCSS('top','10px');
  await page.keyboard.press('Escape');
  await page.locator('[data-swipe-share]').evaluate(button=>button.click());
  await expect(page.locator('[data-share-qr-code] svg')).toBeVisible();
  expect(uploads).toBe(1);
  await page.keyboard.press('Escape');
  remote=null;
  await page.locator('[data-swipe-share]').evaluate(button=>button.click());
  await expect(page.locator('[data-share-qr-code] svg')).toBeVisible();
  await expect(page.locator('[data-sharing-state="online"]')).toHaveCount(1);
  await expect(page.locator('[data-sharing-details]')).not.toContainText('opgehaald of verwijderd');
  expect(uploads).toBe(2);
  const centered=await page.locator('.sh-share-qr-panel').evaluate(panel=>{const code=panel.querySelector('[data-share-qr-code] svg').getBoundingClientRect(),box=panel.getBoundingClientRect();return Math.abs((code.left+code.right)/2-(box.left+box.right)/2);});
  expect(centered).toBeLessThan(1);
  await expect(page.locator('[data-share-title]')).toHaveText('Testpas met een langere titel');
  await expect(page.locator('.sh-share-side-right')).toHaveCSS('transform','matrix(-1, 0, 0, -1, 0, 0)');
  const locationToggle=page.getByRole('button',{name:'Locatie meesturen',exact:true});
  const clearOfButton=await page.locator('[data-qr-status]').evaluate(text=>{const button=document.querySelector('[data-share-location-toggle]');return text.getBoundingClientRect().bottom<=button.getBoundingClientRect().top;});
  expect(clearOfButton).toBe(true);
  await locationToggle.click();await expect(locationToggle).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>uploads).toBe(3);
  await expect(page.locator('[data-qr-status]')).toContainText('Scan in Sharon');
  await expect(page.locator('[data-sharing-details]')).not.toContainText('opgehaald of verwijderd');
  await expect(page.locator('[data-qr-status]')).not.toContainText('Locatie-icoon');
  const geometry=await page.locator('.sh-share-fixed').evaluate(media=>{
    const box=media.getBoundingClientRect(),title=media.querySelector('[data-share-title]');
    const handles=[...media.querySelectorAll('[data-deck-size]')].map(handle=>{
      const r=handle.getBoundingClientRect();return {center:(r.left+r.right)/2,edge:(r.top+r.bottom)/2,kind:handle.dataset.deckSize};
    });return {center:(box.left+box.right)/2,top:box.top,bottom:box.bottom,titleWidth:title.getBoundingClientRect().width,handles};
  });
  expect(geometry.titleWidth).toBeGreaterThan(30);
  await expect(page.locator('[data-share-item-icon] svg')).toHaveCount(1);
  await expect(page.locator('[data-share-item-icon]')).toHaveCSS('color','rgb(209, 43, 84)');
  const iconPosition=await page.locator('[data-share-item-icon]').evaluate(icon=>{const r=icon.getBoundingClientRect(),board=icon.closest('.sh-share-fixed').getBoundingClientRect();return {left:r.left-board.left,top:r.top-board.top};});
  expect(iconPosition.left).toBe(14);expect(iconPosition.top).toBe(16);
  const person=page.locator('[data-share-person="AlphaUser001"]');await expect(person).toBeVisible();
  await expect(person).toHaveCSS('border-top-width','0px');await expect(person).toHaveCSS('border-right-width','0px');
  const controls=await page.locator('.sh-share-fixed').evaluate(header=>{const pill=header.querySelector('[data-deck-grab]'),toggle=header.querySelector('[data-share-publication]'),pin=header.querySelector('[data-share-location-toggle]');return !pill.contains(toggle)&&!pill.contains(pin)&&Math.abs(toggle.getBoundingClientRect().left-pill.getBoundingClientRect().right-12)<1;});expect(controls).toBe(true);
  const rowHeight=(await person.boundingBox()).height;expect(rowHeight).toBeGreaterThanOrEqual(44);expect(rowHeight).toBeLessThanOrEqual(56);

  for(const handle of geometry.handles){expect(Math.abs(handle.center-geometry.center)).toBeLessThan(1);expect(Math.abs(handle.edge-(handle.kind==='board'?geometry.top:geometry.bottom))).toBeLessThan(1);}
  const grab=page.locator('[data-deck-grab]'),stack=page.locator('.sh-share-zone-stack');
  const grabBox=await grab.boundingBox(),x=grabBox.x+18,y=grabBox.y+grabBox.height/2;
  const beforePosition=await stack.boundingBox();
  let cdp;
  if(browserName==='chromium'){
    cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y}]});
  }else{
    await grab.evaluate((button,{x,y})=>{button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:99,pointerType:'touch',clientX:x,clientY:y}));window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:99,pointerType:'touch',clientX:x+35,clientY:y}));},{x,y});
  }
  await expect(stack).toHaveClass(/is-card-deck-lifted/);
  await expect.poll(()=>page.locator('.sh-share-zone-stack .sh-board-deck-card-1').evaluate(card=>getComputedStyle(card).transform)).toBe('matrix(1, 0, 0, 1, -3, -3)');
  // Continuing the gathering swipe horizontally must not move the stack.
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70,y}]});
  else await page.evaluate(({x,y})=>window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:99,pointerType:'touch',clientX:x+70,clientY:y})),{x,y});
  const gatheredPosition=await stack.boundingBox();
  expect(Math.abs(gatheredPosition.x-beforePosition.x)).toBeLessThan(1);
  expect(Math.abs(gatheredPosition.y-beforePosition.y)).toBeLessThan(1);
  const beforeY=await stack.evaluate(el=>parseFloat(el.style.getPropertyValue('--card-deck-y')));
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+100,y:y-35}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else await page.evaluate(({x,y})=>{for(const type of ['pointermove','pointerup'])window.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:99,pointerType:'touch',clientX:x+100,clientY:y-35}));},{x,y});
  await expect(stack).not.toHaveClass(/is-card-deck-lifted/);
  const afterPosition=await stack.boundingBox();
  expect(Math.abs(afterPosition.x-beforePosition.x)).toBeLessThan(1);
  expect(beforePosition.y-afterPosition.y).toBeGreaterThan(20);
  expect(await stack.evaluate(el=>parseFloat(el.style.getPropertyValue('--card-deck-y')))).toBeLessThan(beforeY-20);
  await expect(page.locator('.sh-share-board [data-list-sort="logical"]')).toHaveAttribute('aria-pressed','true');
  await page.waitForTimeout(450); // The release click must not change the sort.
  const pill=page.locator('[data-deck-grab]');await page.locator('.sh-share-board [data-list-sort="custom"]').click();await pill.click();
  const pillBox=await pill.boundingBox();await page.mouse.move(pillBox.x+pillBox.width-15,pillBox.y+pillBox.height/2);await page.mouse.down();await page.mouse.move(pillBox.x+15,pillBox.y+pillBox.height/2,{steps:8});await page.mouse.up();
  await expect(page.locator('[data-share-search-wrap]')).toBeVisible();
  await expect(page.locator('.sh-share-board [data-list-sort="custom"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-share-close]')).toHaveCount(0);
  await expect(page.locator('.sh-share-board [data-deck-size]')).toHaveCount(2);
  const scroll=await page.locator('.sh-share-board-info').evaluate(element=>{
    const filler=document.createElement('div');filler.style.height='600px';element.append(filler);
    const header=element.closest('.sh-share-board').querySelector('.sh-share-fixed');
    const toolbar=element.querySelector('[data-share-toolbar]');const toolbarBefore=toolbar.getBoundingClientRect().top;
    const before=header.getBoundingClientRect().top;element.scrollTop=100;
    return {moved:header.getBoundingClientRect().top-before,toolbarMoved:toolbar.getBoundingClientRect().top-toolbarBefore,scrolled:element.scrollTop};
  });
  expect(scroll.scrolled).toBeGreaterThan(0);expect(scroll.moved).toBe(0);expect(scroll.toolbarMoved).toBeLessThan(-50);
  const publication=page.getByRole('switch',{name:'QR-deling online',exact:true});
  await expect(publication).toBeChecked();await expect(publication).toBeEnabled();await publication.uncheck();
  await expect(publication).not.toBeChecked();
  await expect(page.locator('[data-share-qr-code] svg')).toHaveCount(0);
  await expect(page.locator('[data-sharing-state]')).toHaveCount(0);
  expect(remote).toBeNull();
  await page.evaluate(async version=>{
    const {ObjectStore}=await import('/src/core/storage/ObjectStore.js?v='+version);
    const {mountSharingBadges}=await import('/src/ui/SharingStatus.js?v='+version);
    const store=await new ObjectStore().open();
    await store.put('objects',{id:'SharedMsg001',type:'chat-message',chatId:'AlphaChat001',sharedObjectId:'PrivateCard1',delivery:'sent',sharedConfirmedAt:Date.now()});
    await mountSharingBadges(document,store,{refresh:false});
  },version);
  await expect(page.locator('[data-sharing-state="shared"]')).toHaveCSS('background-color','rgb(141, 152, 166)');
  await publication.check();await expect(page.locator('[data-share-qr-code] svg')).toBeVisible();
  const header=await page.locator('.sh-share-side-left').boundingBox();
  await page.mouse.move(header.x+header.width/2,header.y+header.height/2);
  await page.mouse.down();await page.mouse.move(header.x+header.width/2,header.y+header.height/2+110,{steps:8});await page.mouse.up();
  await expect(page.locator('.sh-card-share-overlay')).toHaveCount(0);
});
