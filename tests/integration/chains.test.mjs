import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const spec=path=>'./src/'+path+'?v='+version;
async function setup(){
 const app=await appHarness();const {EventBus}=await app.load(spec('core/events/EventBus.js'));const events=new EventBus();
 const {environmentIdForPoint}=await app.load(spec('core/location/EnvironmentIdentifier.js'));
 const point={lat:52,lng:5,accuracy:10,at:Date.now()};
 const row=['branch000001','node/1',environmentIdForPoint(point,6),52000000,5000000,'Albert Heijn','Winkelstraat 1','active',1,'2026-10-23T00:00:00Z',''];
 await app.store.setMeta('chains.local.v1',{schema:1,chains:{Q1653985:{version:'v1-'+'a'.repeat(24),rows:[row],lastCheckedAt:Date.now(),coverage:'NL'}}});
 const card={id:'card00000001',type:'card',name:'Mijn bonuspas',chainId:'Q1653985',cardKind:'loyalty'};await app.store.put('objects',card);
 return {app,events,point,card};
}
test('card name recognizes a chain, enables its switch and saves the link',async()=>{
 const {app,events,point,card}=await setup();let close;
 try{
  const {openCardsView}=await app.load(spec('ui/CardsView.js'));
  const host=app.document.createElement('div'),header=app.document.createElement('div');app.document.body.append(host,header);
  close=await openCardsView(host,{store:app.store,events,location:{latest:point},headerActions:header});
  (await until(()=>header.querySelector('[aria-label="Kaart toevoegen"]'))).click();
  const form=await until(()=>host.querySelector('[data-card-form]'));
  assert.equal(form.elements.chainId.value,'');form.elements.name.value='Jumbo pas';form.elements.name.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  assert.equal(form.elements.chainId.value,'Q2262314');assert.equal(form.elements.chainLinkEnabled.checked,true);
  assert.equal(form.querySelector('[data-chain-link]').hidden,false);
  form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
  const saved=await until(async()=>(await app.store.getAll('objects')).find(item=>item.type==='card'&&item.name==='Jumbo pas'));
  assert.equal(saved.chainId,'Q2262314');assert.equal(saved.locationId,null);
 }finally{close?.();app.close();}
});
test('slider input previews without saving; release saves one personal zone and removal restores coarse recognition',async()=>{
 const {app,events,point,card}=await setup();let stop;
 try{
  const {mountChainZonePanel}=await app.load(spec('ui/ChainZonePanel.js'));
  const host=app.document.createElement('div');app.document.body.append(host);
  stop=mountChainZonePanel(host,{card,store:app.store,location:{latest:point},events});
  const slider=await until(()=>host.querySelector('[data-chain-radius]'));
  slider.value='50';slider.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  assert.equal((await app.store.getAll('objects')).filter(item=>item.data?.personalZone).length,0);
  slider.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  const own=await until(async()=>(await app.store.getAll('objects')).find(item=>item.data?.personalZone));
  assert.equal(own.data.branchId,'branch000001');assert.equal(own.data.coordinates.lat,point.lat);assert.equal(own.data.radiusM,50);
  slider.value='80';slider.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  await until(async()=> (await app.store.get('objects',own.id)).data.radiusM===80);
  assert.equal((await app.store.getAll('objects')).filter(item=>item.data?.personalZone).length,1);
  assert.equal(app.requests.length,0);
  let route;events.on('environment.chain.open',event=>{route=event.detail.chainId;});
  [...host.querySelectorAll('button')].find(button=>button.textContent.includes('in Omgeving')).click();assert.equal(route,'Q1653985');
  // Reopening reads the saved refinement and exposes its removal.
  stop();stop=mountChainZonePanel(host,{card,store:app.store,location:{latest:point},events});
  const reset=await until(()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Persoonlijke verfijning verwijderen'));
  reset.click();await until(async()=>!(await app.store.get('objects',own.id)).data.personalZone);
  assert.equal(app.requests.length,0);
 }finally{stop?.();app.close();}
});

test('Omgeving uses local chain points, saves a branch to Locations and does not persist a temporary filter',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><select data-chain-filter hidden></select><small data-chain-status hidden></small>';app.document.body.append(root);
  const sources=new Map(),handlers=new Map();let hit=null,popupNode;
  const map={addSource(id,options){sources.set(id,{options,data:options.data,setData(data){this.data=data;}});},addLayer(){},getSource:id=>sources.get(id),
    on(name,fn){handlers.set(name,fn);},off(name){handlers.delete(name);},easeTo(){},getZoom:()=>14,queryRenderedFeatures:()=>hit?[hit]:[]};
  class Popup{setLngLat(){return this;}setDOMContent(node){popupNode=node;return this;}addTo(){return this;}remove(){}}
  layer=mountChainLayer(map,{Popup},{root,store:app.store,events,location:{latest:point},initialChainId:'Q1653985'});
  await until(()=>sources.get('sharon-chain-branches').data.features.length===1);
  assert.equal(root.querySelector('select').value,'Q1653985');
  hit=sources.get('sharon-chain-branches').data.features[0];handlers.get('click')({point:{x:10,y:10}});
  popupNode.querySelector('button').click();
  const saved=await until(async()=>(await app.store.getAll('objects')).find(item=>item.type==='location'&&item.data?.branchId==='branch000001'));
  assert.equal(saved.data.chainId,'Q1653985');assert.equal(saved.data.personalZone,undefined);assert.equal(saved.data.coordinates.lat,52);
  assert.equal(app.requests.length,0);assert.equal((await app.store.getAll('meta')).some(item=>item.key.includes('filter')),false);
 }finally{layer?.destroy();app.close();}
});

test('upward source swipe opens known locations and chains; search and saved location deck work offline',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  await app.store.put('objects',{id:'knownplace01',type:'location',data:{title:'Mijn werk',coordinates:{lat:52.001,lng:5},address:'Werkstraat 2'}});
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><section data-places-sheet aria-hidden="true"><header><button data-places-close></button></header><select data-chain-filter></select><input data-places-search><small data-chain-status></small><div data-places-list></div></section>';app.document.body.append(root);
  const sources=new Map(),handlers=new Map();
  const map={addSource(id,o){sources.set(id,{setData(data){this.data=data;}});},addLayer(){},getSource:id=>sources.get(id),on(n,f){handlers.set(n,f);},off(n){handlers.delete(n);},easeTo(){},getCenter:()=>point,queryRenderedFeatures:()=>[]};
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point}});
  await until(()=>root.querySelector('[data-places-list]').textContent.includes('Mijn werk'));
  const toggle=root.querySelector('[data-chain-toggle]');
  const touch=(type,x,y)=>{const e=new app.window.Event(type,{bubbles:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:x,clientY:y}]});toggle.dispatchEvent(e);};
  touch('touchstart',20,200);touch('touchend',22,130);toggle.click();
  assert.equal(root.querySelector('[data-places-sheet]').getAttribute('aria-hidden'),'false');
  assert.equal(toggle.getAttribute('aria-pressed'),'true');
  assert.match(root.querySelector('[data-places-list]').textContent,/Albert Heijn/);
  const search=root.querySelector('input');search.value='Werkstraat';search.dispatchEvent(new app.window.Event('input'));
  assert.equal(root.querySelectorAll('[data-places-list] button').length,1);
  root.querySelector('[data-places-list] button').click();
  await until(()=>app.document.querySelector('.sh-board-overlay'));
  assert.equal(root.querySelector('[data-places-sheet]').getAttribute('aria-hidden'),'true');
  assert.equal(app.requests.length,0);
  layer.destroy();layer=null;assert.equal(handlers.size,0);
 }finally{layer?.destroy();app.close();}
});

test('public branch board has attribution and save action without private location editing controls',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><section data-places-sheet><select data-chain-filter></select><small data-chain-status></small><div data-places-list></div></section>';app.document.body.append(root);
  const sources=new Map(),handlers=new Map();
  const map={addSource(id,o){sources.set(id,{setData(data){this.data=data;}});},addLayer(){},getSource:id=>sources.get(id),on(n,f){handlers.set(n,f);},off(n){handlers.delete(n);},easeTo(){},getCenter:()=>point,queryRenderedFeatures:()=>[]};
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point},initialChainId:'Q1653985'});
  (await until(()=>root.querySelector('[data-places-list] button'))).click();
  const board=await until(()=>app.document.querySelector('.sh-board-overlay'));
  const credit=board.querySelector('a[href="https://www.openstreetmap.org/copyright"]');
  assert.equal(credit.textContent,'© OpenStreetMap');assert.match(credit.getAttribute('aria-label'),/OpenStreetMap contributors.*ODbL/);
  assert.equal(board.querySelector('[aria-label="Webpagina aan locatie koppelen"]'),null);
  assert.ok(board.querySelector('a[href="https://www.openstreetmap.org/node/1"]'));
  const save=[...board.querySelectorAll('button')].find(button=>button.textContent==='Bewaar bij Locaties');assert.ok(save);save.click();
  await until(async()=>(await app.store.getAll('objects')).some(item=>item.data?.branchId==='branch000001'));
  assert.equal(app.requests.length,0);
 }finally{layer?.destroy();app.close();}
});

test('chain opt-out survives further typing, unknown names clear the link and non-loyalty cards do not auto-link',async()=>{
 const {app,events,point}=await setup();let close;
 try{
  const {openCardsView}=await app.load(spec('ui/CardsView.js'));
  const host=app.document.createElement('div'),header=app.document.createElement('div');app.document.body.append(host,header);
  close=await openCardsView(host,{store:app.store,events,location:{latest:point},headerActions:header});
  (await until(()=>header.querySelector('[aria-label="Kaart toevoegen"]'))).click();
  const form=await until(()=>host.querySelector('[data-card-form]'));
  const type=value=>{form.elements.name.value=value;form.elements.name.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
  type('AH');assert.equal(form.elements.chainId.value,'Q1653985');
  form.elements.chainLinkEnabled.checked=false;form.elements.chainLinkEnabled.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  type('AH bonuskaart');assert.equal(form.elements.chainId.value,'');assert.equal(form.elements.chainLinkEnabled.checked,false);
  type('Onbekende winkel');assert.equal(form.querySelector('[data-chain-link]').hidden,true);assert.equal(form.elements.chainId.value,'');
  type('Jumbo');assert.equal(form.elements.chainLinkEnabled.checked,false);
  form.elements.chainLinkEnabled.checked=true;form.elements.chainLinkEnabled.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  form.querySelector('[data-kind="membership"]').click();assert.equal(form.querySelector('[data-chain-link]').hidden,true);assert.equal(form.elements.chainId.value,'');
  form.querySelector('[data-kind="loyalty"]').click();assert.equal(form.elements.chainId.value,'Q2262314');
  form.elements.chainLinkEnabled.checked=false;form.elements.chainLinkEnabled.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
  const saved=await until(async()=>(await app.store.getAll('objects')).find(item=>item.name==='Jumbo'));
  assert.equal(saved.chainId,null);assert.equal(saved.chainLinkEnabled,false);assert.equal(app.requests.length,0);
 }finally{close?.();app.close();}
});

test('search text seeds a new card and recognizes its chain without a separate chain selector',async()=>{
 const {app,events,point}=await setup();let close;
 try{
  const {openCardsView}=await app.load(spec('ui/CardsView.js'));
  const host=app.document.createElement('div'),header=app.document.createElement('div');app.document.body.append(host,header);
  close=await openCardsView(host,{store:app.store,events,location:{latest:point},headerActions:header});
  const search=host.querySelector('[data-list-search]');search.value='Kruidvat';search.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  (await until(()=>header.querySelector('[aria-label="Kaart toevoegen"]'))).click();
  const form=await until(()=>host.querySelector('[data-card-form]'));
  await until(()=>form.elements.chainId.value==='Q2226366');
  assert.equal(form.elements.name.value,'Kruidvat');assert.equal(form.elements.chainLinkEnabled.checked,true);
  assert.equal(form.querySelector('select[name="chainId"]'),null);assert.equal(app.requests.length,0);
 }finally{close?.();app.close();}
});

test('editing preserves an explicit chain despite a conflicting nickname and remembers stored opt-out',async()=>{
 const {app,events,point,card}=await setup();let close;
 try{
  await app.store.put('objects',{...card,name:'Jumbo bijnaam'});
  await app.store.put('objects',{id:'optout000001',type:'card',name:'HEMA',cardKind:'loyalty',chainId:null,chainLinkEnabled:false});
  const {openCardsView}=await app.load(spec('ui/CardsView.js'));
  const host=app.document.createElement('div'),header=app.document.createElement('div');app.document.body.append(host,header);
  close=await openCardsView(host,{store:app.store,events,location:{latest:point},headerActions:header});
  host.querySelector('[data-swipe-row="'+card.id+'"] [data-swipe-edit]').click();
  let form=await until(()=>host.querySelector('[data-card-form]'));
  assert.equal(form.elements.chainId.value,'Q1653985');
  form.querySelector('[data-card-cancel]').click();
  (await until(()=>host.querySelector('[data-swipe-row="optout000001"] [data-swipe-edit]'))).click();
  form=await until(()=>host.querySelector('[data-card-form]'));
  assert.equal(form.querySelector('[data-chain-link]').hidden,false);assert.equal(form.querySelector('[data-chain-name]').textContent,'HEMA');
  assert.equal(form.elements.chainLinkEnabled.checked,false);assert.equal(form.elements.chainId.value,'');
  form.elements.name.value='HEMA pas';form.elements.name.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  assert.equal(form.elements.chainLinkEnabled.checked,false);
 }finally{close?.();app.close();}
});

test('branch points stay unclustered; board ratings persist, retract and hide/restore the map point',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><section data-places-sheet><select data-chain-filter></select><small data-chain-status></small><div data-places-list></div></section>';app.document.body.append(root);
  const sources=new Map(),layers=[];let active;
  app.window.addEventListener('sharon-place-board-active',e=>{active=e.detail.point;});
  const map={addSource(id,o){sources.set(id,{options:o,setData(data){this.data=data;}});},addLayer(o){layers.push(o);},getSource:id=>sources.get(id),on(){},off(){},easeTo(){},getCenter:()=>point,queryRenderedFeatures:()=>[]};
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point},initialChainId:'Q1653985'});
  (await until(()=>root.querySelector('[data-places-list] button'))).click();
  const board=await until(()=>app.document.querySelector('.sh-board-overlay'));
  const source=sources.get('sharon-chain-branches');assert.equal(source.options.cluster,undefined);assert.equal(layers.length,1);assert.equal(layers[0].paint['circle-radius'],6);
  assert.equal(active.lat,52);
  const button=label=>board.querySelector('[aria-label="'+label+'"]');
  button('Vind ik leuk').click();assert.equal(button('Hartje verwijderen').getAttribute('aria-pressed'),'true');
  button('Niet leuk').click();assert.equal(button('Vind ik leuk').getAttribute('aria-pressed'),'false');
  button('Niet leuk verwijderen').click();button('Markeer als gelezen').click();
  button('Verberg deze locatie op de kaart').click();assert.equal(source.data.features.length,0);assert.equal(active,null);
  button('Toon deze locatie weer op de kaart').click();assert.equal(source.data.features.length,1);
  const saved=JSON.parse(app.window.localStorage.getItem('sharon.place.feedback.v1:node/1'));
  assert.equal(saved.read,true);assert.equal(saved.liked,false);assert.equal(saved.disliked,false);assert.equal(saved.hidden,false);
 }finally{layer?.destroy();app.close();}
});

test('Omgeving browses an unlinked chain and loads details only when its board opens',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));const root=app.document.createElement('div');
  root.innerHTML='<button data-chain-toggle></button><section data-places-sheet><select data-chain-filter></select><small data-chain-status></small><div data-places-list></div></section>';app.document.body.append(root);
  const sources=new Map(),handlers=new Map(),calls=[],version='v1-'+'a'.repeat(24);
  app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);calls.push(q);return {ok:true,json:async()=>q.action==='catalog'?{schema:1,version,chains:[{id:'Q999999',name:'Andere keten'}]}:q.action==='map'?{schema:1,version,points:[['remote000001','Q999999',5000000,52000000,'Andere winkel','node/99']]}:{schema:1,version,detail:{id:q.id,chainId:'Q999999',sourceRef:'node/99',address:'Bronstraat 99',openingHours:'',website:''}}};};
  const map={addSource(id,o){sources.set(id,{setData(data){this.data=data;}});},addLayer(){},getSource:id=>sources.get(id),on(n,f){handlers.set(n,f);},off(n){handlers.delete(n);},easeTo(){},getCenter:()=>point,getZoom:()=>15,getBounds:()=>({getWest:()=>4.99,getSouth:()=>51.99,getEast:()=>5.01,getNorth:()=>52.01}),queryRenderedFeatures:()=>[]};
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point}});root.querySelector('[data-chain-toggle]').click();
  await until(()=>sources.get('sharon-chain-branches')?.data.features.some(f=>f.id==='remote000001'));
  assert.ok(root.querySelector('option[value="Q999999"]'));assert.equal(calls.filter(q=>q.action==='detail').length,0);
  [...root.querySelectorAll('[data-places-list] button')].find(b=>b.textContent.includes('Andere winkel')).click();
  await until(()=>app.document.querySelector('.sh-board-overlay')?.textContent.includes('Bronstraat 99'));
  assert.equal(calls.filter(q=>q.action==='detail').length,1);
  assert.ok(!JSON.stringify(calls).includes('accuracy'));
 }finally{layer?.destroy();app.close();}
});
