import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAIN_CATALOG} from '../src/core/chains/ChainCatalog.js';
import {fetchChainSource,chainQuery,buildChainRegister,probeOverpass} from '../scripts/update-chain-register.mjs';

const brands=CHAIN_CATALOG.flatMap(chain=>chain.brands);
const requestedBrand=url=>new URL(url).searchParams.get('data').match(/brand:wikidata"="(Q\d+)"/)[1];
const source=(brand,index=brands.indexOf(brand))=>({osm3s:{timestamp_osm_base:'2026-10-23T10:00:00Z'},elements:[{
 type:'node',id:index+1,version:1,timestamp:'2026-10-22T10:00:00Z',lat:52,lon:5,tags:{'brand:wikidata':brand,name:brand,shop:'supermarket'}
}]});
const ok=data=>({ok:true,json:async()=>data});
const options={endpoints:['https://first.example/api','https://second.example/api'],wait:async()=>{},log:()=>{},rounds:1};

test('one exact indexed query per brand replaces the nationwide regular expression',()=>{
 for(const id of brands){const query=chainQuery(id);assert.match(query,new RegExp('brand:wikidata"="'+id+'"'));assert.ok(!query.includes('~'));assert.match(query,/timeout:25/);}
 assert.throws(()=>chainQuery('Q1";out;'));
});
test('timeout switches provider, successful provider leads later parts and all chains are retained',async()=>{
 const calls=[],logs=[];
 const data=await fetchChainSource({...options,log:value=>logs.push(value),fetcher:async(url,request)=>{
  calls.push(url);assert.equal(request.body,undefined);assert.equal(request.headers.Accept,'application/json');
  if(new URL(url).host==='first.example')throw new DOMException('aborted','TimeoutError');
  return ok(source(requestedBrand(url)));
 }});
 assert.equal(calls.length,brands.length+1);
 assert.ok(calls.slice(1).every(url=>new URL(url).host==='second.example'));
 assert.equal(data.elements.length,brands.length);
 const register=buildChainRegister(data);assert.equal(Object.keys(register.chains).length,CHAIN_CATALOG.length);
 assert.ok(logs.some(value=>value.includes('first.example')&&value.includes('time-out')));
});
test('malformed JSON data, provider remarks and HTTP rate limits use the next source',async()=>{
 for(const failed of [()=>ok({elements:[]}),()=>ok({remark:'runtime error',elements:[]}),()=>({ok:false,status:429})]){
  let attempts=0;
  const data=await fetchChainSource({...options,fetcher:async url=>{attempts++;return new URL(url).host==='first.example'?failed():ok(source(requestedBrand(url)));}});
  assert.equal(data.elements.length,brands.length);assert.equal(attempts,brands.length+1);
 }
});
test('a transient provider recovers in the next bounded retry round',async()=>{
 let attempts=0,pauses=0;
 const data=await fetchChainSource({...options,endpoints:['https://first.example/api'],rounds:2,wait:async()=>{pauses++;},fetcher:async url=>{
  attempts++;if(attempts===1)throw Error('temporary');return ok(source(requestedBrand(url)));
 }});
 assert.equal(pauses,1);assert.equal(data.elements.length,brands.length);
});
test('failure after some successful parts rejects the whole import instead of publishing partial data',async()=>{
 let requests=0;
 await assert.rejects(fetchChainSource({...options,fetcher:async url=>{
  requests++;const brand=requestedBrand(url);
  if(brand===brands[2])throw Error('unreachable');return ok(source(brand));
 }}),error=>error.message.includes(brands[2])&&error.message.includes('Bestaand register blijft behouden')&&error.message.includes('first.example'));
 assert.equal(requests,4);
});
test('empty optional brand variant is allowed, source snapshot time uses the oldest complete part',async()=>{
 const data=await fetchChainSource({...options,fetcher:async url=>{
  const brand=requestedBrand(url),data=source(brand);
  if(brand===brands[1])data.elements=[];
  if(brand===brands.at(-1))data.osm3s.timestamp_osm_base='2026-10-22T09:00:00Z';
  return ok(data);
 }});
 assert.equal(data.osm3s.timestamp_osm_base,'2026-10-22T09:00:00.000Z');
 assert.equal(Object.keys(buildChainRegister(data).chains).length,CHAIN_CATALOG.length);
});

test('brand-matching offices are filtered locally and never become store locations',async()=>{
 const data=await fetchChainSource({...options,fetcher:async url=>{
  const brand=requestedBrand(url),part=source(brand);
  part.elements.push({...part.elements[0],id:9999,tags:{'brand:wikidata':brand,office:'company'}});
  assert.ok(!new URL(url).searchParams.get('data').includes('["shop"]'));
  assert.match(new URL(url).searchParams.get('data'),/50\.7,3\.2,53\.7,7\.3/);
  return ok(part);
 }});
 assert.equal(data.elements.length,brands.length);assert.ok(!data.elements.some(item=>item.id===9999));
});
test('failure diagnostics distinguish status/query reachability without printing element contents',async()=>{
 const logs=[],calls=[];
 await probeOverpass({endpoints:['https://first.example/api/interpreter'],log:value=>logs.push(value),fetcher:async url=>{
  calls.push(url);return {status:200,text:async()=> 'do-not-log-element-contents'};
 }});
 assert.equal(calls.length,2);assert.ok(calls[0].endsWith('/status'));assert.ok(logs.some(line=>line.includes('minimale query')));
 assert.ok(logs.every(line=>!line.includes('do-not-log')));
});

test('country export retains exact OSM identities, collapses duplicate geometries and filters offices',async()=>{
 const {sourceFromGeoJSON}=await import('../scripts/update-chain-register.mjs');
 const properties={'@type':'way','@id':42,'@version':2,'@timestamp':1792713600,'brand:wikidata':brands[0],shop:'supermarket',name:'Bronwinkel'};
 const feature={type:'Feature',properties,geometry:{type:'Polygon',coordinates:[[[5,52],[5.002,52],[5.002,52.002],[5,52]]]}};
 const data=sourceFromGeoJSON({type:'FeatureCollection',features:[feature,feature,{...feature,properties:{...properties,'@id':43,shop:undefined,office:'company'}}]},'2026-10-23T10:00:00Z');
 assert.equal(data.elements.length,1);const item=data.elements[0];
 assert.equal(item.id,42);assert.equal(item.type,'way');assert.equal(item.version,2);assert.ok(Math.abs(item.center.lat-52.001)<1e-9);assert.ok(Math.abs(item.center.lon-5.001)<1e-9);
 assert.ok(!Object.keys(item.tags).some(key=>key.startsWith('@')));
 assert.throws(()=>sourceFromGeoJSON({type:'FeatureCollection',features:[]},''));
});
