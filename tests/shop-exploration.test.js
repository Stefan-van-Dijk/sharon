import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {ShopAreaCache} from '../src/core/chains/ShopAreaCache.js';
import {ChainBrowse} from '../src/core/chains/ChainBrowse.js';
const empty={schema:1,version:'v1-'+'a'.repeat(24),coverage:'WORLD',points:[],truncated:false};
test('a pending cell finishes and the next request follows the new viewport',async()=>{
 const browse=new ChainBrowse({requestIntervalMs:0});let release;const seen=[];
 browse.area=async b=>{seen.push(b);if(seen.length===1)await new Promise(r=>release=r);return {points:[],truncated:false};};
 const work=browse.progressiveArea([4.401,51.221,4.405,51.225]);
 browse.setViewport([5.0001,52.0001,5.0019,52.0019]);release();await work;
 assert.equal(seen.length,2);assert.ok(seen[1][0]>=5);
});
test('exploration continues beyond four cells and cached cells do not consume the next network budget',async()=>{
 let calls=0;const browse=new ChainBrowse({requestIntervalMs:0,fetcher:async()=>{calls++;return {ok:true,json:async()=>empty};}});
 const bounds=[4.4,51.2,4.44,51.24];
 const first=await browse.progressiveArea(bounds);assert.equal(calls,32);assert.equal(first.incomplete,true);
 await browse.progressiveArea(bounds);assert.equal(calls,64);
});
test('public snapshots survive a new cache instance and evict old entries within limits',async()=>{
 const db=new IDBFactory(),first=new ShopAreaCache(db);
 await first.put('one',{at:1,data:empty});assert.deepEqual(await new ShopAreaCache(db).get('one'),{at:1,data:empty});
 for(let i=0;i<130;i++)await first.put('k'+i,{at:i+2,data:empty});
 assert.equal(await first.get('one'),null);assert.ok(await first.get('k129'));
 assert.equal(await new ShopAreaCache(null).get('missing'),null);
});
test('fresh persistent snapshot renders without network after reopening',async()=>{
 const db=new IDBFactory(),bounds=[4.4,51.2,4.401,51.201];
 const key='map:'+JSON.stringify([bounds,'']);const cache=new ShopAreaCache(db);
 await cache.put(key,{at:Date.now(),data:empty});
 const browse=new ChainBrowse({useAreaStorage:true,fetcher:()=>{throw Error('Network must not be used');}});browse.diskCache=new ShopAreaCache(db);
 assert.deepEqual((await browse.loadArea(bounds)).points,[]);
});
test('old persistent snapshot is available while a refresh is pending',async()=>{
 const browse=new ChainBrowse({useAreaStorage:true});let release;
 browse.diskCache={get:async()=>({at:0,data:empty}),put:async()=>{}};
 browse.request=()=>new Promise(r=>release=r);
 const data=await browse.cached('old',{action:'map',world:true,bounds:[4,51,4.001,51.001]});
 assert.equal(data.stale,true);release(empty);await Promise.all(browse.localRefreshes.values());
});
test('explicit forced refresh bypasses the persistent snapshot',async()=>{
 const bounds=[4.4001,51.2001,4.4019,51.2019];let calls=0;
 const browse=new ChainBrowse({useAreaStorage:true,forceRefresh:true,requestIntervalMs:0});
 browse.diskCache={get:async()=>({at:Date.now(),data:empty}),put:async()=>{}};
 browse.request=async()=>{calls++;return empty;};
 await browse.progressiveArea(bounds);assert.equal(calls,1);
});
