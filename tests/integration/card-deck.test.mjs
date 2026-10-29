import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until,dismissCardBoard} from '../helpers/app-harness.mjs';
const active=app=>app.document.querySelector('[data-card-board][aria-hidden="false"]');
function pointer(app,target,type,x,y=250){
  const event=new app.window.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(event);
}
function swipe(app,target,left=true){
  pointer(app,target,'pointerdown',left?300:100);pointer(app,target,'pointermove',left?100:300);pointer(app,target,'pointerup',left?100:300);
}
function generator(app){
  app.window.TextEncoder=TextEncoder;
  app.window.qrcode=()=>{let value;return{addData:text=>{value=text;},make(){},createSvgTag:()=>'<svg viewBox="0 0 100 100"><title>'+value+'</title></svg>'};};
}

test('real boards form one continuous deck with immediately visible information and pass icons',async t=>{
  const app=await appHarness();let close;t.after(()=>{close?.();app.close();});generator(app);
  const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
  const cards=[{id:'a',name:'Alpha',cardKind:'loyalty',codeFormat:'QR_CODE',codeValue:'code-a'},
    {id:'b',name:'Beta',cardKind:'ticket',codeFormat:'QR_CODE',codeValue:'code-b',fields:Array.from({length:6},(_,i)=>({label:'Veld '+i,value:'Waarde '+i}))}];
  close=openCardBoard(cards[0],{cards,store:app.store});
  const stack=active(app).parentElement;
  assert.equal(stack.querySelectorAll('[data-card-board]').length,3);
  assert.equal(stack.querySelector('.sh-board-deck'),null,'back plates are real boards');
  assert.equal(active(app).querySelector('[data-details]').hidden,false);
  assert.equal(stack.querySelector('[data-expand]'),null);
  assert.equal(stack.querySelector('[data-close]'),null);
  assert.equal(stack.querySelector('[data-deck-position]'),null);
  assert.equal(stack.querySelector('nav'),null);
  assert.equal(stack.querySelector('[data-share-card]'),null,'sharing is opened from the strip swipe');
  assert.equal(active(app).querySelector('[data-deck-size="board"]').parentElement,active(app).querySelector('[data-card-media]'));
  assert.equal(active(app).querySelector('[data-deck-size="media"]').parentElement,active(app).querySelector('[data-card-media]'));
  await until(()=>active(app).querySelector('[data-code] title')?.textContent==='code-a');
  swipe(app,active(app).querySelector('[data-card-media]'));
  assert.equal(active(app).dataset.cardId,'b');
  assert.equal(active(app).querySelector('[data-card-kind]').getAttribute('aria-label'),'Ticket');
  assert.ok(active(app).querySelector('[data-card-media] [data-card-kind] svg'));
  swipe(app,active(app).querySelector('[data-card-media]'));
  assert.equal(active(app).dataset.detailIndex,'1');
  assert.match(active(app).querySelector('[data-details]').textContent,/Veld 4/);
  swipe(app,active(app).querySelector('[data-card-media]'));assert.equal(active(app).dataset.cardId,'a','last board wraps to the first');
  assert.equal(stack.querySelectorAll('[data-card-board]:not([hidden])').length,3,'back boards remain present through wrap');
  assert.equal(app.document.querySelectorAll('[role="dialog"]').length,1);
  swipe(app,active(app).querySelector('[data-card-media]'),false);assert.equal(active(app).dataset.detailIndex,'1','previous from first wraps to last');
  assert.deepEqual(app.errors,[]);
});

test('pill swipe gathers without moving, then drags the whole deck; both zone sizes persist and cancel restores layout',async t=>{
  const app=await appHarness();let close;t.after(()=>{close?.();app.close();});
  const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
  const {EventBus}=await app.load('./src/core/events/EventBus.js');const events=new EventBus();
  const location={latest:{lat:52,lng:6,at:Date.now()}},locations=[{id:'place',data:{title:'Winkel',coordinates:{lat:52,lng:6}}}];
  const cards=[{id:'a',name:'Alpha',locationId:'place'},{id:'b',name:'Beta'}];
  const options={cards,store:app.store,location,locations,events};
  close=openCardBoard(cards[0],options);
  const stack=active(app).parentElement;
  assert.equal(active(app).querySelector('[data-distance]').textContent,'Winkel · 0 m');
  assert.equal(active(app).querySelector('[data-deck-icon]').hasAttribute('hidden'),true);
  location.latest={lat:52.01,lng:6,at:Date.now()};events.emit('location.changed');
  assert.equal(active(app).querySelector('[data-distance]').textContent,'Winkel · 1.1 km');
  const grab=active(app).querySelector('[data-deck-grab]');
  pointer(app,grab,'pointerdown',100,200);
  assert.equal(stack.classList.contains('is-card-deck-lifted'),false,'touch alone does not gather');
  pointer(app,grab,'pointermove',80,200);
  assert.equal(stack.classList.contains('is-card-deck-lifted'),false,'leftward movement does not gather');
  pointer(app,grab,'pointermove',140,200);
  assert.ok(stack.classList.contains('is-card-deck-lifted'));
  assert.equal(stack.style.getPropertyValue('--card-deck-x'),'0px','gathering swipe is consumed without a jump');
  pointer(app,grab,'pointermove',180,220);pointer(app,grab,'pointerup',180,220);
  assert.equal(stack.classList.contains('is-card-deck-lifted'),false,'release puts the deck down');
  assert.equal(active(app).dataset.cardId,'a','pill does not swipe to another pass');
  assert.equal(stack.style.getPropertyValue('--card-deck-x'),'40px');
  const mediaSizer=active(app).querySelector('[data-deck-size="media"]');
  const beforeMedia=parseFloat(stack.style.getPropertyValue('--card-deck-media'));
  pointer(app,mediaSizer,'pointerdown',200,300);pointer(app,mediaSizer,'pointermove',200,325);pointer(app,mediaSizer,'pointerup',200,325);
  assert.equal(parseFloat(stack.style.getPropertyValue('--card-deck-media')),beforeMedia+25);
  const boardSizer=active(app).querySelector('[data-deck-size="board"]');
  const beforeHeight=parseFloat(stack.style.getPropertyValue('--card-deck-height'));
  const beforeY=stack.style.getPropertyValue('--card-deck-y');
  pointer(app,boardSizer,'pointerdown',200,200);pointer(app,boardSizer,'pointermove',200,180);pointer(app,boardSizer,'pointerup',200,180);
  assert.equal(parseFloat(stack.style.getPropertyValue('--card-deck-height')),beforeHeight+20);
  assert.equal(stack.style.getPropertyValue('--card-deck-y'),beforeY,'bottom anchor already accounts for the changed height');
  const height=stack.style.getPropertyValue('--card-deck-height'),media=stack.style.getPropertyValue('--card-deck-media');
  pointer(app,grab,'pointerdown',100,200);pointer(app,grab,'pointermove',140,200);pointer(app,grab,'pointermove',220,230);pointer(app,grab,'pointercancel',220,230);
  assert.equal(stack.style.getPropertyValue('--card-deck-x'),'40px');
  swipe(app,active(app).querySelector('[data-card-media]'));
  assert.equal(stack.style.getPropertyValue('--card-deck-media'),media);
  assert.equal(stack.style.getPropertyValue('--card-deck-height'),height);
  await until(async()=>Boolean((await app.store.get('meta','cards.board.layout'))?.value.media));
  close();close=openCardBoard(cards[0],options);
  await until(()=>active(app).parentElement.style.getPropertyValue('--card-deck-height')===height);
  assert.equal(active(app).parentElement.style.getPropertyValue('--card-deck-x'),'40px');
  assert.equal(active(app).parentElement.style.getPropertyValue('--card-deck-media'),media);
  assert.deepEqual(app.errors,[]);
});

test('cards view swipes in the saved custom order and respects search',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  for(const [id,name] of [['DeckCard001','Alpha'],['DeckCard002','Beta'],['DeckCard003','Charlie']])await app.store.put('objects',{id,type:'card',name});
  await app.store.put('meta',{key:'cards.list.preferences',value:{sort:'custom',order:['DeckCard003','DeckCard001','DeckCard002']}});
  await app.boot();(await until(()=>app.document.querySelector('[data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[data-swipe-row="DeckCard003"] .sh-location-row'))).click();
  await until(()=>active(app));swipe(app,active(app).querySelector('[data-card-media]'));assert.equal(active(app).dataset.cardId,'DeckCard001');
  await dismissCardBoard(app);
  const search=app.document.querySelector('[data-list-search]');search.value='Beta';search.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  app.document.querySelector('[data-swipe-row="DeckCard002"] .sh-location-row').click();
  await until(()=>active(app));assert.equal(active(app).querySelector('[data-deck-position]'),null);
  swipe(app,active(app).querySelector('[data-card-media]'),false);assert.equal(active(app).dataset.cardId,'DeckCard002');
  await dismissCardBoard(app);assert.deepEqual(app.errors,[]);
});

test('delayed generators keep each board code separate and a downward swipe closes the deck',async t=>{
  const app=await appHarness();let close;t.after(()=>{close?.();app.close();});app.window.TextEncoder=TextEncoder;
  const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
  const cards=['a','b'].map(id=>({id,name:id,codeFormat:'QR_CODE',codeValue:id}));
  close=openCardBoard(cards[0],{cards});swipe(app,active(app).querySelector('[data-card-media]'));
  generator(app);app.document.querySelector('script[src*="qrcode"]').dispatchEvent(new app.window.Event('load'));
  await until(()=>active(app).querySelector('[data-code] title')?.textContent==='b');
  assert.equal(active(app).querySelectorAll('[data-code] svg').length,1);
  const media=active(app).querySelector('[data-card-media]');
  pointer(app,media,'pointerdown',200,200);pointer(app,media,'pointermove',200,300);pointer(app,media,'pointerup',200,300);
  assert.equal(active(app),null);assert.deepEqual(app.errors,[]);
});

test('real generators center enlarged QR, fill the barcode frame and show only the location label when available',async t=>{
  const app=await appHarness();let close;t.after(()=>{close?.();app.close();});
  app.window.TextEncoder=TextEncoder;
  app.window.eval(readFileSync(new URL('../../vendor/qrcode-2.0.4.js',import.meta.url),'utf8'));
  app.window.eval(readFileSync(new URL('../../vendor/jsbarcode-3.12.1.min.js',import.meta.url),'utf8'));
  const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
  const {EventBus}=await app.load('./src/core/events/EventBus.js');const events=new EventBus();
  const cards=[{id:'qr',name:'QR',codeFormat:'QR_CODE',codeValue:'test-qr',locationId:'place'},
    {id:'barcode',name:'Barcode',codeFormat:'CODE128',codeValue:'123456789'}];
  const locations=[{id:'place',data:{title:'Rolde'}}];
  close=openCardBoard(cards[0],{cards,locations,events});
  let board=active(app);
  const qr=await until(()=>board.querySelector('[data-code] svg'));
  assert.equal(qr.getAttribute('preserveAspectRatio'),'xMidYMid meet','overrides the real QR generator’s top-left alignment');
  assert.ok(qr.querySelector('path'));
  assert.equal(board.dataset.codeType,'qr');
  assert.equal(board.querySelector('[data-deck-icon]').hasAttribute('hidden'),true);
  assert.equal(board.querySelector('[data-distance]').textContent,'Rolde');
  assert.equal(app.window.getComputedStyle(board.querySelector('[data-deck-grab]')).flexDirection,'row');
  assert.equal(app.window.getComputedStyle(board.querySelector('[data-code]>div')).aspectRatio,'1');
  assert.equal(board.querySelector('[data-card-location-pin]').hidden,false);
  assert.equal(board.querySelector('[data-card-title]').parentElement,board.querySelector('[data-card-media]'));
  assert.match(app.window.getComputedStyle(board.querySelector('[data-card-title]')).transform,/rotate\(-90deg\)/);
  const title=board.querySelector('[data-card-title]');
  assert.equal(app.window.getComputedStyle(title).whiteSpace,'normal');assert.equal(app.window.getComputedStyle(title).textOverflow,'clip');
  Object.defineProperty(title,'scrollHeight',{configurable:true,value:90});app.window.dispatchEvent(new app.window.Event('resize'));
  assert.equal(board.querySelector('[data-card-media]').style.getPropertyValue('--qr-title-band'),'114px');
  const handleStyle=app.window.getComputedStyle(board.querySelector('[data-deck-size="board"]'));
  assert.equal(handleStyle.height,'30px');assert.equal(handleStyle.top,'-15px');
  assert.equal(app.window.getComputedStyle(board.querySelector('[data-deck-size="media"]')).bottom,'-15px');

  assert.equal(board.querySelector('nav'),null);
  swipe(app,board.querySelector('[data-card-media]'));board=active(app);
  const barcode=await until(()=>board.querySelector('[data-code] svg'));
  assert.equal(board.dataset.codeType,'barcode');
  assert.equal(board.querySelector('[data-card-location-pin]').hidden,true);
  assert.equal(barcode.getAttribute('preserveAspectRatio'),'none');
  assert.ok(barcode.querySelectorAll('rect').length>20,'the real barcode bars remain present');
  assert.equal(app.window.getComputedStyle(board.querySelector('[data-code]>div')).width,'100%');
  assert.equal(app.window.getComputedStyle(board.querySelector('[data-code]>div')).height,'100%');
  assert.equal(board.querySelector('[data-deck-icon]').hasAttribute('hidden'),false,'without a location the gathering icon remains available');
  assert.equal(board.querySelector('[data-distance]').textContent,'');
  locations[0].data.title='Station';events.emit('location.changed');
  swipe(app,board.querySelector('[data-card-media]'),false);
  assert.equal(active(app).querySelector('[data-distance]').textContent,'Station');
  assert.equal(active(app).querySelector('[data-deck-icon]').hasAttribute('hidden'),true);
  assert.deepEqual(app.errors,[]);
});

test('mobile restores a horizontally centered deck and a gathering swipe only enables vertical dragging',async t=>{
 const app=await appHarness();t.after(()=>app.close());
 Object.defineProperty(app.window,'innerWidth',{value:390,configurable:true});
 await app.store.setMeta('cards.board.layout',{x:.2,y:0,height:.65,media:.3});
 const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
 const close=openCardBoard({id:'a',name:'Alpha'},{store:app.store});t.after(close);
 const stack=active(app).parentElement;
 await until(()=>parseFloat(stack.style.getPropertyValue('--card-deck-height'))===app.window.innerHeight*.65);
 assert.equal(stack.style.getPropertyValue('--card-deck-x'),'0px');
 const grab=active(app).querySelector('[data-deck-grab]');
 pointer(app,grab,'pointerdown',50,300);pointer(app,grab,'pointermove',85,300);pointer(app,grab,'pointermove',150,300);
 assert.equal(stack.style.getPropertyValue('--card-deck-x'),'0px');assert.equal(stack.style.getPropertyValue('--card-deck-y'),'0px');
 pointer(app,grab,'pointermove',170,270);pointer(app,grab,'pointerup',170,270);
 assert.equal(stack.style.getPropertyValue('--card-deck-x'),'0px');assert.equal(stack.style.getPropertyValue('--card-deck-y'),'-30px');
 await until(async()=> (await app.store.get('meta','cards.board.layout')).value.y<0);
 assert.equal((await app.store.get('meta','cards.board.layout')).value.x,0);
});

 test('empty pass offers code editing for the active card and closes the board',async t=>{
 const app=await appHarness();t.after(()=>app.close());const {openCardBoard}=await app.load('./src/ui/CardBoard.js');let edited;
 const close=openCardBoard({id:'empty',name:'Lege kaart',codeFormat:'CODE128'},{store:app.store,onEdit:id=>{edited=id;}});t.after(close);
 assert.equal(active(app).dataset.codeType,'empty');active(app).querySelector('[data-add-card-code]').click();
 assert.equal(edited,'empty');assert.equal(active(app),null);
});
