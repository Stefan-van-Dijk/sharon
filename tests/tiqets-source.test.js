import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tiqetsFeatures, tiqetsBoard, tiqetsLink, tiqetsImage, fetchTiqetsPlaces, tiqetsStatus } from '../src/ui/TiqetsSource.js';
import { mountTiqetsLayer } from '../src/ui/TiqetsLayer.js';
import { ANALYSIS_RANGE_EVENT, ANALYSIS_RANGE_KEY } from '../src/ui/AnalysisRange.js';

const product = (extra = {}) => ({
  id:'123', title:'Museumticket', sale_status:'available',
  geolocation:{lat:52.1,lng:5.1}, venue:{id:'99',name:'Museum',address:'Museumstraat 1'},
  city_name:'Voorbeeldstad', summary:'Een museumbezoek.',
  product_url:'https://www.tiqets.com/nl/ticket-p123/?partner=sharon',
  images:[{large:'https://cdn.tiqets.com/photo.jpg',credit:'Fotograaf',alt_text:'Museumfoto'}],
  ...extra
});
test('Tiqets groups venue products, preserves ticket links and excludes invalid locations and offers', () => {
  const data = tiqetsFeatures([product(), product({id:'124',product_url:'https://www.tiqets.com/nl/ticket-p124/?partner=sharon'}),
    product({id:'125',geolocation:null}), product({id:'126',sale_status:'unavailable'}),
    product({id:'127',geolocation:{lat:null,lng:null}}), product({id:'128',product_url:'javascript:alert(1)'})]);
  assert.equal(data.features.length, 1);
  assert.equal(data.features[0].properties.products.length, 2);
  const board = tiqetsBoard(data.features[0]);
  assert.equal(board.sections.length, 2);
  assert.match(board.sections[1].url, /p124/);
  assert.equal(board.sections[0].imageCredit, 'Fotograaf');
  assert.equal(board.sections[0].imageAlt, 'Museumfoto');
  assert.equal(tiqetsFeatures([product({images:[]})]).features[0].properties.image, '');
});
test('outbound Tiqets links require HTTPS, a genuine host and partner attribution', () => {
  for (const url of ['https://evil.test/?partner=sharon','https://tiqets.com.evil.test/?partner=sharon',
    'https://www.tiqets.com/path','http://www.tiqets.com/?partner=sharon',
    'https://user@www.tiqets.com/?partner=sharon','https://www.tiqets.com:444/?partner=sharon']) assert.equal(tiqetsLink(url), '');
  assert.match(tiqetsLink(product().product_url), /partner=sharon/);
  assert.equal(tiqetsImage('https://evil.test/photo.jpg'), '');
  assert.equal(tiqetsImage('javascript:alert(1)'), '');
});
test('live requests send only map centre and language with no browser credentials or cached response', async () => {
  let options;
  const data = await fetchTiqetsPlaces({lat:52.1,lng:5.1,personId:'private'}, {fetcher:async (url, value) => {
    options=value;
    assert.equal(new URL(url).search, '');
    return {ok:true,json:async()=>({source:'tiqets',products:[product()]})};
  }});
  assert.equal(data.features.length,1);
  assert.deepEqual(JSON.parse(options.body),{lat:52.1,lng:5.1,lang:'nl'});
  assert.equal(options.cache,'no-store');
  assert.equal(options.credentials,'omit');
  assert.equal(options.headers.Authorization,undefined);
  assert.equal(await tiqetsStatus({fetcher:async()=>({ok:true,json:async()=>({configured:false})})}),false);
  await assert.rejects(fetchTiqetsPlaces({lat:52,lng:5},{fetcher:async()=>({ok:false,status:503})}),/nog niet/);
});
function fakeMap() {
  const sources=new Map(),layers=new Map(),events=new Map();
  return {
    getSource:id=>sources.get(id), getLayer:id=>layers.get(id),
    addSource(id,value){sources.set(id,{data:value.data,setData(data){this.data=data;}});},
    addLayer(value){layers.set(value.id,value);}, removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),
    getZoom:()=>13,getCenter:()=>({lat:52.1,lng:5.1}),isStyleLoaded:()=>true,
    on(name,fn){events.set(name,fn);},off(name,fn){if(events.get(name)===fn)events.delete(name);},
    fire(name,value){events.get(name)?.(value);}, queryRenderedFeatures:()=>[{id:'tiqets-venue-99'}]
  };
}
test('Tiqets layer ignores late results after disabling and detaches listeners', async () => {
  const map=fakeMap(); let resolve;
  const binding=mountTiqetsLayer(map,{fetchPlaces:()=>new Promise(done=>{resolve=done;})});
  binding.setEnabled(true);
  binding.setEnabled(false);
  resolve(tiqetsFeatures([product()]));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(map.getSource('sharon-tiqets').data.features.length,0);
  binding.destroy();
  assert.equal(map.getSource('sharon-tiqets'),undefined);
});
test('failed live refresh removes previous map offers and cannot open an old marker', async () => {
  const map=fakeMap();let fail=false,opened=0;
  const binding=mountTiqetsLayer(map,{onOpen:()=>opened++,fetchPlaces:async()=>{
    if(fail)throw Error('network');return tiqetsFeatures([product()]);
  }});
  binding.setEnabled(true);await Promise.resolve();await Promise.resolve();
  map.fire('click',{point:{x:1,y:1}});assert.equal(opened,1);
  fail=true;map.fire('moveend');
  assert.equal(map.getSource('sharon-tiqets').data.features.length,0);
  await new Promise(resolve=>setTimeout(resolve,500));
  map.fire('click',{point:{x:1,y:1}});assert.equal(opened,1);
  binding.destroy();
});

test('Tiqets range changes redraw browser markers and destroy removes the range listener', async t => {
  const events = new EventTarget();
  let stored = JSON.stringify({meters:100,unlimited:false});
  for (const [key,value] of Object.entries({window:events,localStorage:{getItem:key=>key===ANALYSIS_RANGE_KEY?stored:null}})) {
    const previous = Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
  }
  const add = t.mock.method(events, 'addEventListener');
  const remove = t.mock.method(events, 'removeEventListener');
  const map = fakeMap();
  const binding = mountTiqetsLayer(map, {fetchPlaces:async()=>tiqetsFeatures([
    product(), product({id:'124',venue:{id:'100',name:'Verder weg'},geolocation:{lat:52.11,lng:5.1}})
  ])});
  t.after(()=>binding.destroy());
  binding.setEnabled(true);
  await Promise.resolve(); await Promise.resolve();
  const source = map.getSource('sharon-tiqets');
  assert.equal(source.data.features.length,1);
  stored = JSON.stringify({meters:100,unlimited:true});
  events.dispatchEvent(new Event(ANALYSIS_RANGE_EVENT));
  assert.equal(source.data.features.length,2);
  assert.equal(binding.getBoards().length,2);
  const listener = add.mock.calls.find(call=>call.arguments[0]===ANALYSIS_RANGE_EVENT).arguments[1];
  binding.destroy();
  assert.ok(remove.mock.calls.some(call=>call.arguments[0]===ANALYSIS_RANGE_EVENT&&call.arguments[1]===listener));
  const setData = t.mock.method(source, 'setData');
  events.dispatchEvent(new Event(ANALYSIS_RANGE_EVENT));
  assert.equal(setData.mock.callCount(),0);
});

function php(expression) {
  const source='require "server/tiqets.php"; '+expression;
  return execFileSync('php',['-r',source],{encoding:'utf8'});
}
test('PHP adapter syntax, filtering, partner validation and image permission', () => {
  execFileSync('php',['-l','server/tiqets.php']);
  const items=[product(),product({id:'124',product_url:'https://www.tiqets.com/?partner=someoneelse'}),
    product({id:'125',geolocation:null}),product({id:'126',sale_status:'unavailable'}),
    product({id:'127',marketing_restrictions_detailed:[{type:'TARGETING'}]})];
  const encoded=Buffer.from(JSON.stringify(items)).toString('base64');
  const run=images=>JSON.parse(php('$items=json_decode(base64_decode("'+encoded+'"),true); echo json_encode(tiqets_products($items,"sharon",'+images+'));'));
  assert.equal(run('true').length,1);
  assert.equal(run('true')[0].images[0].credit,'Fotograaf');
  assert.deepEqual(run('false')[0].images,[]);
});
test('PHP uses only verified nearby API parameters and keeps credentials out of response', () => {
  const encoded=Buffer.from(JSON.stringify(product())).toString('base64');
  const result=JSON.parse(php('$product=json_decode(base64_decode("'+encoded+'"),true); $seen=[]; '+
    '$result=tiqets_query(["lat"=>52.1,"lng"=>5.1,"lang"=>"nl","url"=>"https://evil.test"],"private-test-token","sharon",false,'+
    'function($url,$headers)use(&$seen,$product){$seen=[$url,$headers];return ["success"=>true,"products"=>[$product]];}); '+
    'echo json_encode(["seen"=>$seen,"result"=>$result]);'));
  const url=new URL(result.seen[0]);
  assert.equal(url.origin,'https://api.tiqets.com');
  assert.equal(url.searchParams.get('max_distance'),'5');
  assert.equal(url.searchParams.get('require_venue'),'true');
  assert.equal(url.searchParams.get('sort'),'distance asc');
  assert.ok(result.seen[1].includes('Authorization: Token private-test-token'));
  assert.ok(!JSON.stringify(result.result).includes('private-test-token'));
});

test('explicit save creates a ticket reference and one linked place, never a fake admission code', async () => {
  const {saveTicketReference} = await import('../src/core/cards/TicketReferenceService.js');
  const objects = new Map();
  const store = {getAll:async()=>[...objects.values()],put:async(table,item)=>objects.set(item.id,structuredClone(item))};
  const reference = {provider:'tiqets',label:'Tiqets',productId:'123',placeId:'venue-99',
    title:'Museumticket',placeTitle:'Museum',url:product().product_url,coordinates:{lat:52.1,lng:5.1}};
  const results = await Promise.all([saveTicketReference(store,reference),saveTicketReference(store,reference)]);
  assert.equal(results[0].id,results[1].id);
  assert.equal(objects.size,2);
  const card=results[0];
  assert.equal(card.cardKind,'ticket');
  assert.equal(card.codeFormat,'');
  assert.equal(card.codeValue,'');
  assert.equal(objects.get(card.locationId).data.title,'Museum');
  const enriched={...card,codeFormat:'QR_CODE',codeValue:'a-real-ticket-code',name:'Mijn museumticket'};
  objects.set(card.id,enriched);
  assert.deepEqual(await saveTicketReference(store,reference),enriched);
  const second=await saveTicketReference(store,{...reference,productId:'124'});
  assert.equal(second.locationId,card.locationId);
  assert.equal(objects.size,3);
});

test('ticket references may stand alone and a retry reuses a place after a failed card write', async () => {
  const {saveTicketReference}=await import('../src/core/cards/TicketReferenceService.js');
  const objects=new Map();let fail=true;
  const store={getAll:async()=>[...objects.values()],put:async(table,item)=>{
    if(item.type==='card'&&fail)throw Error('disk full');
    objects.set(item.id,item);
  }};
  const reference={provider:'tiqets',productId:'123',placeId:'venue-99',
    title:'Museumticket',url:product().product_url,coordinates:{lat:52.1,lng:5.1}};
  await assert.rejects(saveTicketReference(store,reference),/disk full/);
  assert.equal(objects.size,1);
  fail=false;
  await saveTicketReference(store,reference);
  assert.equal(objects.size,2);
  const standalone=await saveTicketReference(store,{...reference,productId:'124',coordinates:null});
  assert.equal(standalone.locationId,null);
});
