import test from 'node:test';import assert from 'node:assert/strict';
import {fetchShopSource} from '../src/core/chains/ShopSource.js';
import {fetchWikipediaPlaces} from '../src/ui/WikipediaLayer.js';
test('direct store discovery works without PHP and preserves IDs for details',async()=>{
 const fetcher=async(url,options)=>{assert.ok(url.startsWith('https://overpass.private.coffee/'));assert.equal(options.credentials,'omit');assert.equal(options.method,'POST');assert.ok(options.body.startsWith('data='));return {ok:true,json:async()=>({elements:[{type:'node',id:123,lat:52,lon:5,tags:{shop:'bakery',name:'Bakker'}}]})};};
 const input={action:'map',bounds:[4.99,51.99,5.01,52.01]};
 const a=await fetchShopSource(input,{fetcher}),b=await fetchShopSource(input,{fetcher});assert.equal(a.points[0][0],b.points[0][0]);
 const d=await fetchShopSource({action:'detail',sourceRef:'node/123',id:a.points[0][0]},{fetcher});assert.equal(d.detail.id,a.points[0][0]);
 await assert.rejects(fetchShopSource({action:'map',bounds:[-180,-90,180,90]},{fetcher}));
});
test('Wikipedia API errors cannot become permanently cached empty coverage',async()=>{
 await assert.rejects(fetchWikipediaPlaces({lat:52,lng:5},{fetcher:async()=>({ok:true,json:async()=>({error:{code:'maxlag'}})})}),/geldig/);
});
test('direct fallback preserves foreign chain filtering and amenity coverage',async()=>{
 const elements=[
  {type:'node',id:401309938,lat:51.22,lon:4.4,tags:{shop:'chocolate',name:'Elisa Pralines'}},
  {type:'node',id:7340616847,lat:51.22,lon:4.4,tags:{shop:'department_store',name:'HEMA','brand:wikidata':'Q903805'}},
  {type:'node',id:12,lat:51.22,lon:4.4,tags:{amenity:'cafe',name:'Coffee'}},
  {type:'node',id:13,lat:51.22,lon:4.4,tags:{office:'company',name:'Office'}}];
 const fetcher=async()=>({ok:true,json:async()=>({elements})});
 const map=await fetchShopSource({action:'map',bounds:[4.39,51.21,4.41,51.23]},{fetcher});
 assert.deepEqual(map.points.map(p=>p[4]),['Elisa Pralines','HEMA','Coffee']);
 const chain=await fetchShopSource({action:'map',bounds:[4.39,51.21,4.41,51.23],chainId:'Q903805'},{fetcher});
 assert.deepEqual(chain.points.map(p=>p[4]),['HEMA']);
 const detail=await fetchShopSource({action:'detail',sourceRef:'node/7340616847',id:chain.points[0][0]},{fetcher});
 assert.equal(detail.detail.chainId,'Q903805');
});
test('only a method rejection retries GET, never a blocked or rate-limited source',async()=>{
 for(const status of [405,415]){
  const calls=[];await fetchShopSource({action:'map',bounds:[4.39,51.21,4.41,51.23]},{fetcher:async(url,options)=>{calls.push({url,options});return calls.length===1?{ok:false,status}:{ok:true,json:async()=>({elements:[]})};}});
  assert.equal(calls.length,2);assert.equal(calls[0].options.method,'POST');assert.ok(calls[1].url.includes('?data='));
 }
 for(const status of [406,429]){let calls=0;await assert.rejects(fetchShopSource({action:'map',bounds:[4.39,51.21,4.41,51.23]},{fetcher:async()=>{calls++;return {ok:false,status};}}));assert.equal(calls,1);}
});
