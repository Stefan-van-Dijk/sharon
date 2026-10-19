import test from 'node:test';
import assert from 'node:assert/strict';
import {appHarness,until} from '../helpers/app-harness.mjs';
function pointer(app,target,type,x,y=250){
  const event=new app.window.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(event);
}
function swipe(app,target,left=true){
  pointer(app,target,'pointerdown',left?300:100);pointer(app,target,'pointermove',left?100:300);pointer(app,target,'pointerup',left?100:300);
}
test('pasdeck changes codes compact, detail pages expanded, and preserves dragged layout',async t=>{
  const app=await appHarness();let close;
  t.after(()=>{close?.();app.close();});
  // Minimal generator verifies each pass uses its own code host, without a network request.
  app.window.TextEncoder=TextEncoder;
  app.window.qrcode=()=>{let value;return{addData:text=>{value=text;},make(){},createSvgTag:()=>'<svg viewBox="0 0 100 100"><title>'+value+'</title></svg>'};};
  const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
  const cards=[{id:'a',name:'Alpha',cardKind:'loyalty',codeFormat:'QR_CODE',codeValue:'code-a'},
    {id:'b',name:'Beta',cardKind:'ticket',codeFormat:'QR_CODE',codeValue:'code-b',fields:Array.from({length:6},(_,i)=>({label:'Veld '+i,value:'Waarde '+i}))}];
  close=openCardBoard(cards[0],{cards,store:app.store});
  const board=app.document.querySelector('.sh-card-deck-board'),media=board.querySelector('[data-card-media]'),grab=board.querySelector('[data-deck-grab]'),stack=board.parentElement;
  await until(()=>board.querySelector('[data-code] title')?.textContent==='code-a');
  assert.equal(board.querySelector('[data-details]').hidden,true);
  swipe(app,media);
  await until(()=>board.querySelector('[data-code] title')?.textContent==='code-b');
  assert.equal(board.querySelector('[data-card-kind]').textContent,'Ticket');
  board.querySelector('[data-expand]').click();swipe(app,media);
  assert.equal(board.dataset.cardId,'b');assert.equal(board.dataset.detailIndex,'1');
  assert.match(board.querySelector('[data-detail-rows]').textContent,/Veld 4/);
  swipe(app,media);assert.equal(board.dataset.detailIndex,'1','last detail does not switch passes');
  pointer(app,grab,'pointerdown',100,200);
  await until(()=>stack.classList.contains('is-card-deck-lifted'));
  pointer(app,grab,'pointermove',140,220);pointer(app,grab,'pointerup',140,220);
  await until(async()=>Boolean(await app.store.get('meta','cards.board.layout')));
  const x=stack.style.getPropertyValue('--card-deck-x');assert.equal(x,'40px');
  board.querySelector('[data-expand]').click();swipe(app,media,false);
  assert.equal(board.dataset.cardId,'a');assert.equal(stack.style.getPropertyValue('--card-deck-x'),x);
  pointer(app,grab,'pointerdown',100,200);await until(()=>stack.classList.contains('is-card-deck-lifted'));
  pointer(app,grab,'pointermove',180,230);pointer(app,grab,'pointercancel',180,230);
  assert.equal(stack.style.getPropertyValue('--card-deck-x'),x);
  close();close=openCardBoard(cards[0],{cards,store:app.store});
  await until(()=>app.document.querySelector('.sh-card-deck-stack').style.getPropertyValue('--card-deck-x')===x);
  assert.deepEqual(app.errors,[]);
});

test('cards view swipes in the saved custom order and respects search',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  for(const [id,name] of [['DeckCard001','Alpha'],['DeckCard002','Beta'],['DeckCard003','Charlie']])await app.store.put('objects',{id,type:'card',name});
  await app.store.put('meta',{key:'cards.list.preferences',value:{sort:'custom',order:['DeckCard003','DeckCard001','DeckCard002']}});
  await app.boot();(await until(()=>app.document.querySelector('[data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[data-swipe-row="DeckCard003"] [data-swipe-open]')||app.document.querySelector('[data-swipe-row="DeckCard003"] .sh-location-row'))).click();
  let board=await until(()=>app.document.querySelector('.sh-card-deck-board'));
  swipe(app,board.querySelector('[data-card-media]'));assert.equal(board.dataset.cardId,'DeckCard001');
  board.querySelector('[data-close]').click();
  const search=app.document.querySelector('[data-list-search]');search.value='Beta';search.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  app.document.querySelector('[data-swipe-row="DeckCard002"] .sh-location-row').click();
  board=await until(()=>app.document.querySelector('.sh-card-deck-board'));
  assert.equal(board.querySelector('[data-deck-position]').textContent,'1 / 1');
  swipe(app,board.querySelector('[data-card-media]'),false);assert.equal(board.dataset.cardId,'DeckCard002');
  board.querySelector('[data-close]').click();assert.deepEqual(app.errors,[]);
});

test('a delayed code generator cannot overwrite the newly selected pass',async t=>{
  const app=await appHarness();let close;t.after(()=>{close?.();app.close();});
  app.window.TextEncoder=TextEncoder;
  const {openCardBoard}=await app.load('./src/ui/CardBoard.js');
  const cards=['a','b'].map(id=>({id,name:id,codeFormat:'QR_CODE',codeValue:id}));
  close=openCardBoard(cards[0],{cards});
  const board=app.document.querySelector('.sh-card-deck-board');
  swipe(app,board.querySelector('[data-card-media]'));
  app.window.qrcode=()=>{let value;return{addData:text=>{value=text;},make(){},createSvgTag:()=>'<svg><title>'+value+'</title></svg>'};};
  app.document.querySelector('script[src*="qrcode"]').dispatchEvent(new app.window.Event('load'));
  await until(()=>board.querySelector('[data-code] title')?.textContent==='b');
  assert.equal(board.querySelectorAll('[data-code] svg').length,1);
  // Vertical code gestures toggle details without changing the active pass.
  const media=board.querySelector('[data-card-media]');
  pointer(app,media,'pointerdown',200,300);pointer(app,media,'pointermove',200,200);pointer(app,media,'pointerup',200,200);
  assert.equal(board.querySelector('[data-details]').hidden,false);assert.equal(board.dataset.cardId,'b');
  pointer(app,media,'pointerdown',200,200);pointer(app,media,'pointermove',200,300);pointer(app,media,'pointerup',200,300);
  assert.equal(board.querySelector('[data-details]').hidden,true);
  assert.deepEqual(app.errors,[]);
});
