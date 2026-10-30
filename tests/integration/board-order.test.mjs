import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const spec=path=>'./src/'+path+'?v='+version;

test('a separate gear beside the sources controls all four board orders and retains the Wikipedia preference',async()=>{
 const app=await appHarness();let close;
 try{
  const {EventBus}=await app.load(spec('core/events/EventBus.js'));
  const {openEnvironmentView}=await app.load(spec('ui/EnvironmentMapLibre.js'));
  app.window.localStorage.setItem('sharon.source.wikipedia.filters.v1',JSON.stringify({sort:'popular',categories:['bouw']}));
  const root=app.document.createElement('div');app.document.body.append(root);
  const open=()=>openEnvironmentView(root,{store:app.store,events:new EventBus(),location:{latest:{lat:52,lng:5}},loadRenderer:()=>new Promise(()=>{})});
  close=open();
  const gear=root.querySelector('[data-board-order-settings]'),panel=root.querySelector('[data-board-order-sheet]');
  assert.ok(gear.closest('.environment-source-options'));
  assert.equal(root.querySelector('[data-source-sheet] [data-wiki-sort]'),null);
  assert.equal(panel.querySelectorAll('[data-board-order]').length,4);
  assert.equal(panel.querySelector('[aria-pressed="true"]').dataset.boardOrder,'popular');
  assert.equal(panel.hidden,true);
  const wiki=root.querySelector('[data-source-sheet]');wiki.classList.add('is-open');wiki.setAttribute('aria-hidden','false');
  gear.click();assert.equal(panel.hidden,false);assert.equal(gear.getAttribute('aria-expanded'),'true');assert.equal(wiki.getAttribute('aria-hidden'),'true');
  let changes=0;const changed=()=>changes++;app.window.addEventListener('sharon-board-order-changed',changed);
  const requests=app.requests.length;
  panel.querySelector('[data-board-order="nearby"]').click();
  assert.equal(changes,1);assert.equal(panel.hidden,true);assert.equal(app.requests.length,requests,'changing order never fetches source data');
  assert.equal(JSON.parse(app.window.localStorage.getItem('sharon.boards.order.v1')),'nearby');
  gear.click();app.window.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'Escape',cancelable:true}));assert.equal(panel.hidden,true);
  close();close=open();
  assert.equal(root.querySelector('[data-board-order="nearby"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(JSON.parse(app.window.localStorage.getItem('sharon.source.wikipedia.filters.v1')).categories,['bouw']);
  close();close=null;
  root.querySelector('[data-board-order-settings]').click();assert.equal(root.querySelector('[data-board-order-sheet]').hidden,true,'cleanup removes the gear handler');
  app.window.removeEventListener('sharon-board-order-changed',changed);
 }finally{close?.();app.close();}
});

test('changing the shared order also updates an open saved-location deck while retaining its selected board',async()=>{
 const app=await appHarness();let close;
 try{
  const {openLocationDeck}=await app.load(spec('ui/LocationDeck.js'));
  const objects=[['A',52.001],['B',52.002],['C',52.003]].map(([id,lat])=>({id,type:'location',data:{title:'Locatie '+id,coordinates:{lat,lng:5}}}));
  for(const id of ['A','C'])app.window.localStorage.setItem('sharon.place.feedback.v1:location:'+id,JSON.stringify({read:true}));
  close=openLocationDeck({store:app.store,objects,selected:{properties:{id:'A'}},map:{getCenter:()=>({lat:52,lng:5})}});
  const {until}=await import('../helpers/app-harness.mjs');
  await until(()=>app.document.querySelector('.sh-board-overlay')?.textContent.includes('Locatie A'));
  app.window.localStorage.setItem('sharon.boards.order.v1',JSON.stringify('nearby'));
  app.window.dispatchEvent(new app.window.CustomEvent('sharon-board-order-changed'));
  assert.ok(app.document.querySelector('.sh-board-overlay').textContent.includes('Locatie A'));
  const plate=app.document.querySelector('.sh-board-plate');
  const touch=(name,x)=>{const event=new app.window.Event(name,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:[{clientX:x,clientY:100}]});plate.dispatchEvent(event);};
  touch('touchstart',220);touch('touchmove',20);touch('touchend',20);
  await until(()=>app.document.querySelector('.sh-board-overlay')?.textContent.includes('Locatie B'));
 }finally{close?.();app.close();}
});

test('analysis radius can be changed and made unlimited, persists and filters future sources in the shared deck',async()=>{
 const app=await appHarness();let close;
 try{
  const {openEnvironmentView}=await app.load(spec('ui/EnvironmentMapLibre.js'));
  const root=app.document.createElement('div');app.document.body.append(root);
  const open=()=>openEnvironmentView(root,{store:app.store,events:{on:()=>()=>{}},location:{latest:{lat:52,lng:5}},loadRenderer:()=>new Promise(()=>{})});
  close=open();root.querySelector('[data-board-order-settings]').click();
  const requests=app.requests.length;
  const field=root.querySelector('[data-analysis-radius]'),unlimited=root.querySelector('[data-analysis-unlimited]');
  assert.equal(field.value,'10');field.value='0.5';field.dispatchEvent(new app.window.Event('change'));
  const {createEnvironmentBoardSources}=await app.load(spec('ui/EnvironmentBoardSources.js'));
  let nav;const deck=createEnvironmentBoardSources({onOpen:(_,navigation)=>{nav=navigation;}});
  const near={id:'near',coordinates:{lat:52,lng:5}},far={id:'far',coordinates:{lat:53,lng:5}};deck.register({getBoards:()=>[near,far]});
  deck.show(near,{lat:52,lng:5});assert.equal(nav.onNext,null);
  unlimited.checked=true;unlimited.dispatchEvent(new app.window.Event('change'));assert.equal(field.disabled,true);
  deck.show(near,{lat:52,lng:5});assert.equal(typeof nav.onNext,'function');
  assert.equal(app.requests.length,requests,'range settings do not request source data before the map is ready');
  close();close=open();assert.equal(root.querySelector('[data-analysis-unlimited]').checked,true);assert.equal(root.querySelector('[data-analysis-radius]').value,'0.5');
 }finally{close?.();app.close();}
});
