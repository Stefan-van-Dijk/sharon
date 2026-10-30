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
  const form=await until(()=>host.querySelector('[data-card-form][data-card-ready="true"]'));
  assert.equal(form.elements.chainId.value,'');form.elements.name.value='Jumbo pas';form.elements.name.dispatchEvent(new app.window.Event('input',{bubbles:true}));
  assert.equal(form.elements.chainId.value,'Q2262314');assert.equal(form.elements.chainLinkEnabled.checked,true);
  assert.equal(form.querySelector('[data-chain-link]').hidden,false);
  form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
  const saved=await until(async()=>{ const row=(await app.store.getAll('objects')).find(item=>item.type==='card'&&item.name==='Jumbo pas'); if (!row && form.querySelector('[data-card-error]')?.textContent) throw new Error('Kaart opslaan: '+form.querySelector('[data-card-error]').textContent+'; console: '+app.errors.join(' | ')); return row; }, 'Kaart niet opgeslagen: '+form.outerHTML.slice(-450)+'; errors: '+app.errors.join(' | '));
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
  host.querySelector('[aria-label="Bekijk Albert Heijn in Omgeving"]').click();assert.equal(route,'Q1653985');
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
  const form=await until(()=>host.querySelector('[data-card-form][data-card-ready="true"]'));
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
  const saved=await until(async()=>{ const row=(await app.store.getAll('objects')).find(item=>item.name==='Jumbo'); if (!row && form.querySelector('[data-card-error]')?.textContent) throw new Error('Opt-out-kaart opslaan: '+form.querySelector('[data-card-error]').textContent+'; console: '+app.errors.join(' | ')); return row; }, 'Opt-out-kaart niet opgeslagen: '+form.outerHTML.slice(-450)+'; errors: '+app.errors.join(' | '));
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
  const form=await until(()=>host.querySelector('[data-card-form][data-card-ready="true"]'));
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
  app.document.querySelector('[data-card-cancel]').click();
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
  assert.equal(board.querySelector('.sh-board-category').textContent,'Boodschappen');
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

 test('compact branch picker searches beyond the nearest twenty and retains the chosen branch',async()=>{
 const {app,events,card}=await setup();let stop;
 try{
  const cached=await app.store.get('meta','chains.local.v1');const chain=cached.value.chains.Q1653985;
  chain.rows=Array.from({length:25},(_,i)=>{const row=[...chain.rows[0]];row[0]='branch'+String(i).padStart(6,'0');row[5]='Winkel '+String(i).padStart(2,'0');row[6]='Straat '+i;return row;});await app.store.put('meta',cached);
  const {mountChainZonePanel}=await app.load(spec('ui/ChainZonePanel.js'));const host=app.document.createElement('div');app.document.body.append(host);
  stop=mountChainZonePanel(host,{card,store:app.store,events});
  const search=await until(()=>host.querySelector('input[type="search"]'));
  assert.equal(host.querySelector('.sh-chain-register-info').open,false);
  search.value='Straat 24';search.dispatchEvent(new app.window.Event('input'));
  const select=host.querySelector('select');assert.equal(select.options.length,2);select.value='branch000024';select.dispatchEvent(new app.window.Event('change'));
  await until(()=>host.querySelector('.sh-chain-picker summary').textContent.includes('Straat 24'));
  assert.equal(host.querySelector('select').value,'branch000024');assert.equal(app.requests.length,0);
 }finally{stop?.();app.close();}
});

test('shop discovery stays within 10 km, excludes distant cached shops and follows map movement',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  const cached=await app.store.get('meta','chains.local.v1');
  const far=[...cached.value.chains.Q1653985.rows[0]];far[0]='distant00001';far[1]='node/2';far[3]=53000000;far[5]='Verre winkel';
  cached.value.chains.Q1653985.rows.push(far);await app.store.put('meta',cached);
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><section data-places-sheet><select data-chain-filter></select><small data-chain-status></small><div data-places-list></div></section>';app.document.body.append(root);
  const sources=new Map(),handlers=new Map(),calls=[],camera=[],version='v1-'+'a'.repeat(24);let center=point,zoom=14,focused=0;
  app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);calls.push(q);return {ok:true,json:async()=>q.action==='catalog'?{schema:1,version,chains:[{id:'Q1653985',name:'Albert Heijn'}]}:{schema:1,version,points:[['nearby000001','Q1653985',5010000,52010000,'Dichtbij','node/3'],['corner000001','Q1653985',5140000,52080000,'Buiten de straal','node/4']]}};};
  const map={addSource(id){sources.set(id,{setData(data){this.data=data;}});},addLayer(){},getSource:id=>sources.get(id),on(n,f){if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(f);},off(n,f){handlers.get(n)?.delete(f);},easeTo(value){camera.push(value);},getCenter:()=>center,getZoom:()=>zoom,getBounds:()=>({getWest:()=>-180,getSouth:()=>-85,getEast:()=>180,getNorth:()=>85}),queryRenderedFeatures:()=>[]};
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point},onFocus:()=>focused++});root.querySelector('[data-chain-toggle]').click();
  await until(()=>root.querySelector('[data-places-list]').textContent.includes('Dichtbij'));
  assert.ok(!root.querySelector('[data-places-list]').textContent.includes('Verre winkel'));
  assert.ok(!root.querySelector('[data-places-list]').textContent.includes('Buiten de straal'));
  const first=calls.find(q=>q.action==='map');assert.ok(first.bounds[2]-first.bounds[0]<.3);assert.ok(first.bounds[3]-first.bounds[1]<.2);
  [...root.querySelectorAll('[data-places-list] button')].find(b=>b.textContent.includes('Albert Heijn')).click();
  assert.equal(focused,1);assert.deepEqual(Array.from(camera.at(-1).center),[5,52]);layer.closeBoard();
  center={lat:53,lng:5};for(const fn of handlers.get('moveend'))fn();
  await until(()=>calls.filter(q=>q.action==='map').length===2);
  await until(()=>!root.querySelector('[data-places-list]').textContent.includes('Dichtbij'));
  assert.ok(root.querySelector('[data-places-list]').textContent.includes('Verre winkel'));
  zoom=5;for(const fn of handlers.get('moveend'))fn();
  await until(()=>root.querySelector('[data-chain-status]').textContent.includes('Zoom verder'));
  assert.equal(calls.filter(q=>q.action==='map').length,2);
 }finally{layer?.destroy();app.close();}
});

test('mixed environment deck swipes from Wikipedia to a shop and saved location, retaining source filters',async()=>{
 const {app,events,point}=await setup();let layer,close;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const {createEnvironmentBoardSources}=await app.load(spec('ui/EnvironmentBoardSources.js'));
  const {openBoardViewer}=await app.load(spec('ui/BoardViewer.js'));
  await app.store.put('objects',{id:'mixedplace01',type:'location',data:{title:'Eigen werkplek',coordinates:{lat:52.002,lng:5}}});
  app.window.localStorage.setItem('sharon.boards.order.v1',JSON.stringify('nearby'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><select data-chain-filter></select><small data-chain-status></small>';app.document.body.append(root);
  const sources=new Map();
  const map={getCenter:()=>point,addSource(id,o){sources.set(id,{data:o.data,setData(data){this.data=data;}});},getSource:id=>sources.get(id),addLayer(){},on(){},off(){},easeTo(){},queryRenderedFeatures:()=>[]};
  const wiki={id:'Q42',geometry:{type:'Point',coordinates:[5,51.999]},properties:{wikidata:'Q42',title:'Wikipedia toren',url:'https://nl.wikipedia.org/?curid=42'}};
  const deck=createEnvironmentBoardSources({onOpen:(item,nav)=>{
    close?.();layer?.closeBoard();
    if(!deck.openBoard(item,nav))close=openBoardViewer(item,{onNext:nav.onNext,onPrevious:nav.onPrevious});
  }});
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point},initialChainId:'Q1653985',onOpen:item=>deck.show(item,point)});
  deck.register(layer);deck.register({getBoards:()=>[wiki]});
  await until(()=>layer.getBoards().length===1);
  // Remove the temporary chain selection: include saved locations as well.
  root.querySelector('select').value='';root.querySelector('select').dispatchEvent(new app.window.Event('change'));
  assert.equal(layer.getBoards().length,2);
  deck.show(wiki,point);
  const swipe=async(title)=>{
    const plate=app.document.querySelector('.sh-board-plate');
    for(const [type,x] of [['touchstart',220],['touchmove',20],['touchend',20]]){
      const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{touches:{value:[{clientX:x,clientY:100}]},changedTouches:{value:[{clientX:x,clientY:100}]}});plate.dispatchEvent(e);
    }
    await until(()=>app.document.querySelector('.sh-board-overlay')?.textContent.includes(title));
    assert.equal(app.document.querySelectorAll('.sh-board-overlay').length,1);
  };
  await swipe('Eigen werkplek');
  await swipe('Albert Heijn');
  await swipe('Wikipedia toren');
  root.querySelector('button').click();assert.equal(layer.getBoards().length,0);
  deck.show(wiki,point);assert.equal(app.document.querySelector('.sh-board-overlay').textContent.includes('Wikipedia toren'),true);
 }finally{close?.();layer?.destroy();app.close();}
});

test('shop category panel filters markers, list and mixed deck, remembers multi-selection and reports feedback counts',async()=>{
 const {app,events,point}=await setup();let layer;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');
  root.innerHTML='<button data-chain-toggle></button><section data-places-sheet><select data-chain-filter></select><input data-places-search><small data-chain-status></small><div class="environment-source-filter-grid environment-source-status-row" data-chain-statuses></div><div class="environment-source-filter-grid" data-chain-categories></div><div data-places-list></div></section>';app.document.body.append(root);
  const sources=new Map();const map={getCenter:()=>point,addSource(id,o){sources.set(id,{data:o.data,setData(data){this.data=data;}});},getSource:id=>sources.get(id),addLayer(){},on(){},off(){},easeTo(){},queryRenderedFeatures:()=>[]};
  await app.store.put('objects',{id:'ownplace0001',type:'location',data:{title:'Eigen plek',coordinates:{lat:52,lng:5}}});
  const open=()=>mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point},initialChainId:''});
  layer=open();await until(()=>root.querySelector('[data-places-list]').textContent.includes('Albert Heijn'));
  root.querySelector('[data-chain-toggle]').click();
  const category=key=>root.querySelector('[data-chain-category="'+key+'"]');
  assert.equal(category('groceries').querySelector('b').textContent,'1');
  category('fashion').click();
  assert.equal(layer.getBoards().length,0);assert.equal(sources.get('sharon-chain-branches').data.features.length,0);
  assert.ok(!root.querySelector('[data-places-list]').textContent.includes('Albert Heijn'));
  assert.equal(layer.allowsLocation({type:'location',id:'ownplace0001',data:{}}),false);
  category('groceries').click();
  assert.equal(layer.getBoards().length,1);assert.equal(sources.get('sharon-chain-branches').data.features.length,1);
  assert.match(root.querySelector('[data-places-list]').textContent,/Albert Heijn/);
  assert.equal(app.requests.length,0,'filter changes never request details or a new area');
  app.window.localStorage.setItem('sharon.place.feedback.v1:node/1',JSON.stringify({liked:true,hidden:true}));
  app.window.dispatchEvent(new app.window.CustomEvent('sharon-place-feedback-changed'));
  assert.equal(layer.getBoards().length,0);assert.match(category('groceries').querySelector('small').textContent,/♡ 1/);
  root.querySelector('[data-chain-status-filter="hidden"]').click();assert.equal(layer.getBoards().length,1);
  assert.equal(sources.get('sharon-chain-branches').data.features.length,1);
  assert.equal(root.querySelector('[data-chain-status-filter="hidden"]').getAttribute('aria-pressed'),'true');
  layer.destroy();layer=null;
  // Mount a fresh view like re-entering Omgeving.
  root.querySelector('[data-chain-categories]').replaceChildren();root.querySelector('[data-chain-statuses]').replaceChildren();
  layer=open();await until(()=>category('groceries').getAttribute('aria-pressed')==='true');
  assert.equal(category('fashion').getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelector('[data-chain-status-filter="hidden"]').getAttribute('aria-pressed'),'true');
 }finally{layer?.destroy();app.close();}
});

test('remote shop markers remain visible during area refresh and unchanged data is not repainted',async()=>{
 const {app,events,point}=await setup();let layer,release;
 try{
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><select data-chain-filter></select><small data-chain-status></small>';app.document.body.append(root);
  const sources=new Map(),handlers=new Map();let writes=0,hold=false,waiting=false;
  const version='v1-'+'a'.repeat(24);
  app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);if(q.action==='map'&&hold){waiting=true;await new Promise(resolve=>release=resolve);}return {ok:true,json:async()=>q.action==='catalog'?{schema:1,version,chains:[{id:'Q999999',name:'Winkel',kind:'supermarket'}]}:{schema:1,version,points:[['remote000001','Q999999',5000000,52000000,'Winkel','node/99']]}};};
  let center=point;
  const map={addSource(id,o){sources.set(id,{data:o.data,setData(data){this.data=data;writes++;}});},getSource:id=>sources.get(id),addLayer(){},on(n,f){handlers.set(n,f);},off(){},getCenter:()=>center,getZoom:()=>15,getBounds:()=>({getWest:()=>4.9,getEast:()=>5.1,getSouth:()=>51.9,getNorth:()=>52.1}),easeTo(){},queryRenderedFeatures:()=>[]};
  layer=mountChainLayer(map,{}, {root,store:app.store,events,location:{latest:point},initialChainId:'Q999999'});
  await until(()=>sources.get('sharon-chain-branches').data.features.length===1);
  const before=writes;hold=true;center={lat:52.001,lng:5};handlers.get('moveend')();await until(()=>waiting);
  assert.equal(sources.get('sharon-chain-branches').data.features.length,1);assert.equal(writes,before);
  release();release=null;await new Promise(resolve=>setTimeout(resolve,30));assert.equal(writes,before);
 }finally{release?.();layer?.destroy();app.close();}
});
