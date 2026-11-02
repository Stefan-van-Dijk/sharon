import test from 'node:test';import assert from 'node:assert/strict';
import {fetchShopSource} from '../src/core/chains/ShopSource.js';
import {fetchWikipediaPlaces} from '../src/ui/WikipediaLayer.js';
test('direct store discovery works without PHP and preserves IDs for details',async()=>{
 const fetcher=async(url,options)=>{assert.ok(url.startsWith('https://overpass-api.de/'));assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({elements:[{type:'node',id:123,lat:52,lon:5,tags:{shop:'bakery',name:'Bakker'}}]})};};
 const input={action:'map',bounds:[4.99,51.99,5.01,52.01]};
 const a=await fetchShopSource(input,{fetcher}),b=await fetchShopSource(input,{fetcher});assert.equal(a.points[0][0],b.points[0][0]);
 const d=await fetchShopSource({action:'detail',sourceRef:'node/123',id:a.points[0][0]},{fetcher});assert.equal(d.detail.id,a.points[0][0]);
 await assert.rejects(fetchShopSource({action:'map',bounds:[-180,-90,180,90]},{fetcher}));
});
test('Wikipedia API errors cannot become permanently cached empty coverage',async()=>{
 await assert.rejects(fetchWikipediaPlaces({lat:52,lng:5},{fetcher:async()=>({ok:true,json:async()=>({error:{code:'maxlag'}})})}),/geldig/);
});
