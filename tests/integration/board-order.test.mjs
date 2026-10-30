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
  const field=root.querySelector('[data-analysis-radius]');
  assert.equal(field.value,'10');field.value='0.5';field.dispatchEvent(new app.window.Event('change'));
  const {createEnvironmentBoardSources}=await app.load(spec('ui/EnvironmentBoardSources.js'));
  let nav;const deck=createEnvironmentBoardSources({onOpen:(_,navigation)=>{nav=navigation;}});
  const near={id:'near',coordinates:{lat:52,lng:5}},far={id:'far',coordinates:{lat:53,lng:5}};deck.register({getBoards:()=>[near,far]});
  deck.show(near,{lat:52,lng:5});assert.equal(nav.onNext,null);
  field.value='201';field.dispatchEvent(new app.window.Event('input'));assert.match(root.querySelector('[data-analysis-radius-value]').textContent,/∞/);
  deck.show(near,{lat:52,lng:5});assert.equal(typeof nav.onNext,'function');
  assert.equal(app.requests.length,requests,'range settings do not request source data before the map is ready');
  close();close=open();assert.equal(root.querySelector('[data-analysis-radius]').value,'201');
 }finally{close?.();app.close();}
});

test('analysis overlay anchors the current map center and slider updates its circle without following map movement',async()=>{
 const app=await appHarness();let stop;
 try{
  const {mountAnalysisZone}=await app.load(spec('ui/AnalysisZone.js'));
  const {mountAnalysisRange,inAnalysisRange}=await app.load(spec('ui/AnalysisRange.js'));
  const root=app.document.createElement('div');root.innerHTML='<input type="range" min="0" max="201" data-analysis-radius><output data-analysis-radius-value></output><button data-analysis-recenter></button><button data-analysis-fit></button>';app.document.body.append(root);
  let center={lat:52,lng:5},data,fitted;const sources=new Map(),layers=new Map();
  const map={fitBounds(bounds){fitted=bounds;},getCenter:()=>center,addSource(id){sources.set(id,{setData(value){data=value;}});},getSource:id=>sources.get(id),addLayer(layer){layers.set(layer.id,layer);},getLayer:id=>layers.get(id),removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id)};
  const stopControls=mountAnalysisRange(root);stop=()=>{stopControls();stopZone();};const stopZone=mountAnalysisZone(map,root);
  const field=root.querySelector('input');field.value='100';field.dispatchEvent(new app.window.Event('input'));
  assert.deepEqual(Array.from(data.features[1].geometry.coordinates),[5,52]);
  center={lat:55,lng:10};assert.equal(inAnalysisRange(center,center),false,'panning does not move the selected zone');
  root.querySelector('button').click();assert.deepEqual(Array.from(data.features[1].geometry.coordinates),[10,55]);
  field.value='200';field.dispatchEvent(new app.window.Event('input'));assert.equal(data.features.length,2);
  root.querySelector('[data-analysis-fit]').click();assert.equal(data.features.length,0);assert.equal(root.querySelector('[data-analysis-fit]').getAttribute('aria-pressed'),'false');
  root.querySelector('[data-analysis-fit]').click();assert.equal(data.features.length,2);assert.equal(fitted,undefined,'visibility toggle does not move the map');
  field.value='201';field.dispatchEvent(new app.window.Event('input'));assert.equal(data.features.length,1);assert.match(root.querySelector('output').textContent,/∞/);
  field.value='0';field.dispatchEvent(new app.window.Event('input'));assert.equal(data.features.length,1);assert.equal(root.querySelector('output').textContent,'0 km');
  stop();stop=null;assert.equal(sources.size,0);assert.equal(layers.size,0);
 }finally{stop?.();app.close();}
});

test('slider previews the circle continuously but commits source updates only on release',async()=>{
 const app=await appHarness();let stop;
 try{
  const {mountAnalysisRange,ANALYSIS_RANGE_EVENT,ANALYSIS_PREVIEW_EVENT}=await app.load(spec('ui/AnalysisRange.js'));
  const root=app.document.createElement('div');root.innerHTML='<input type="range" min="0" max="201" data-analysis-radius><output data-analysis-radius-value></output>';
  stop=mountAnalysisRange(root);let updates=0,previews=0;
  app.window.addEventListener(ANALYSIS_RANGE_EVENT,()=>updates++);app.window.addEventListener(ANALYSIS_PREVIEW_EVENT,()=>previews++);
  const field=root.querySelector('input');for(const value of [15,20,25]){field.value=value;field.dispatchEvent(new app.window.Event('input'));}
  assert.equal(previews,3);assert.equal(updates,0);assert.equal(root.querySelector('output').textContent,'25 km');
  field.dispatchEvent(new app.window.Event('change'));assert.equal(updates,1);
 }finally{stop?.();app.close();}
});
