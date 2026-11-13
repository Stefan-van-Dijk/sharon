import test from 'node:test';import assert from 'node:assert/strict';
import {EnvironmentShopCache} from '../src/core/chains/EnvironmentShopCache.js';
const bounds=[4.4,51.22,4.42,51.24],snapshot={storage:'environment-shops-v1',schema:1,points:[],stale:false};
test('fresh empty area is a valid cached answer and does not request the source',async()=>{
 const calls=[];const cache=new EnvironmentShopCache(async(_u,o)=>{calls.push(JSON.parse(o.body));return {ok:true,json:async()=>snapshot};});
 assert.deepEqual(await cache.area(bounds),snapshot);assert.deepEqual(calls.map(c=>c.action),['shops-read']);
});
test('stale snapshot is returned while refreshing, failed refresh never triggers update',async()=>{
 let release,updates=0;const calls=[];const cache=new EnvironmentShopCache(async(_u,o)=>{const q=JSON.parse(o.body);calls.push(q);if(q.action==='shops-read')return {ok:true,json:async()=>({...snapshot,stale:true})};await new Promise(r=>release=r);return {ok:false};});
 assert.equal((await cache.area(bounds,{onUpdate:()=>updates++})).stale,true);await new Promise(r=>setImmediate(r));assert.equal(calls.length,2);release();await new Promise(r=>setImmediate(r));assert.equal(updates,0);
});
test('missing or forced areas request refresh with the same bounds',async()=>{
 const calls=[];const cache=new EnvironmentShopCache(async(_u,o)=>{const q=JSON.parse(o.body);calls.push(q);return q.action==='shops-read'?{ok:false}:{ok:true,json:async()=>snapshot};});
 assert.deepEqual(await cache.area(bounds),snapshot);assert.deepEqual(calls.map(q=>q.action),['shops-read','shops-refresh']);
 calls.length=0;await cache.area(bounds,{force:true});assert.equal(calls[0].force,true);assert.deepEqual(calls[0].bounds,bounds);
});
test('shop discovery reads stored point identities without contacting chains',async()=>{
 const {ChainBrowse}=await import('../src/core/chains/ChainBrowse.js');const actions=[];
 const browse=new ChainBrowse({useAreaStorage:true,fetcher:async(url,o)=>{assert.ok(url.includes('/environment/api/tiles.php'));actions.push(JSON.parse(o.body).action);return {ok:true,json:async()=>({...snapshot,coverage:'WORLD',version:'v1-'+'a'.repeat(24),points:[['shop00000001','',4405000,51225000,'Bakker','node/1']],kinds:{shop00000001:'bakery'},truncated:false})};}});
 const result=await browse.area(bounds);assert.equal(result.points[0].id,'shop00000001');assert.equal(result.points[0].sourceRef,'node/1');assert.deepEqual(actions,['shops-read']);
});
test('a busy store uses the independent regional source without calling chains or server refresh',async()=>{
 const {ChainBrowse}=await import('../src/core/chains/ChainBrowse.js');const urls=[];
 const browse=new ChainBrowse({useAreaStorage:true,fetcher:async url=>{urls.push(url);return {ok:false,status:503,json:async()=>({error:'shop_area_unavailable'})};}});
 await assert.rejects(browse.request({action:'map',world:true,bounds}),/Winkelbron/);
 assert.equal(urls.length,2);assert.ok(urls[0].includes('tiles.php'));assert.ok(urls[1].includes('ovp.dresel.systems'));
});
test('stale background refreshes are serialized',async()=>{
 let active=0,maxActive=0;const releases=[];
 const cache=new EnvironmentShopCache(async(_u,o)=>{
  if(JSON.parse(o.body).action==='shops-read')return {ok:true,json:async()=>({...snapshot,stale:true})};
  maxActive=Math.max(maxActive,++active);await new Promise(r=>releases.push(r));active--;return {ok:true,json:async()=>snapshot};
 });
 await cache.area(bounds);await cache.area([5,52,5.01,52.01]);await new Promise(r=>setImmediate(r));
 assert.equal(releases.length,1);releases.shift()();await new Promise(r=>setImmediate(r));assert.equal(releases.length,1);releases.shift()();await cache.background;assert.equal(maxActive,1);
});
test('a missing Paris cell uses discovery without waiting for server refresh',async()=>{
 const actions=[];let discovered=0;
 const cache=new EnvironmentShopCache(async(_u,o)=>{actions.push(JSON.parse(o.body).action);return {ok:false,status:404,json:async()=>({error:'shop_area_unavailable'})};});
 const result=await cache.area([2.35,48.856,2.352,48.858],{discover:async()=>{discovered++;return {...snapshot,points:[['point']]};}});
 assert.equal(result.points.length,1);assert.equal(discovered,1);assert.deepEqual(actions,['shops-read']);
});
test('empty stale coverage is not mistaken for an empty completed search',async()=>{
 const cache=new EnvironmentShopCache(async()=>({ok:true,json:async()=>({...snapshot,stale:true})}));let discoveries=0;
 await cache.area(bounds,{discover:async()=>{discoveries++;return snapshot;}});assert.equal(discoveries,1);
});
