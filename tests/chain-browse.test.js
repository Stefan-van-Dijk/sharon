import test from 'node:test';import assert from 'node:assert/strict';
import {buildBrowse} from '../scripts/build-chain-browse.mjs';
import {ChainBrowse} from '../src/core/chains/ChainBrowse.js';
const register={sourceTimestamp:'2026-10-24T00:00:00Z',chains:{}};
const feature=(id,brand,qid)=>({type:'Feature',properties:{'@type':'node','@id':id,shop:'bakery',brand,'brand:wikidata':qid,name:brand,opening_hours:'Mo-Sa 08:00-18:00','addr:street':'Straat','addr:housenumber':'1',website:'https://example.com'},geometry:{type:'Point',coordinates:[5,52]}});
test('national browse includes unknown brands and unlinked chains, preserves source identities and excludes offices',()=>{
 const data={type:'FeatureCollection',features:[feature(1,'Nieuwe keten','Q9876543'),feature(2,'Lokale keten'),feature(4,'Nieuwe keten'),{...feature(3,'Kantoor','Q1234'),properties:{...feature(3,'Kantoor','Q1234').properties,shop:undefined,office:'company'}}]};
 const first=buildBrowse(data,register),second=buildBrowse(data,register,first);
 assert.equal(first.chains.length,2);assert.equal(first.points.length,3);assert.equal(second.points[0][0],first.points[0][0]);
 assert.equal(first.points[0].length,6);assert.ok(!JSON.stringify(first.points).includes('08:00'));assert.ok(Object.values(first.details).some(d=>d.address==='Straat 1'));
});
test('browse catalog/points/details are separate bounded cached requests with no personal payload',async()=>{
 const calls=[],version='v1-'+'a'.repeat(24);const browse=new ChainBrowse({fetcher:async(_,options)=>{
  const q=JSON.parse(options.body);calls.push(q);assert.equal(options.credentials,'omit');
  return {ok:true,json:async()=>q.action==='catalog'?{schema:1,version,chains:[{id:'Q9876543',name:'Keten'}]}:q.action==='map'?{schema:1,version,points:[['branch000001','Q9876543',5000000,52000000,'Keten','node/1']]}:{schema:1,version,detail:{id:q.id,chainId:'Q9876543',sourceRef:'node/1',address:'Straat 1',openingHours:'',website:'javascript:alert(1)'}}};
 }});
 await browse.catalog();const {points}=await browse.area([4.9,51.9,5.1,52.1]);await browse.area([4.9,51.9,5.1,52.1]);assert.equal(calls.length,2);assert.equal(points[0].address,undefined);
 const detail=await browse.detail(points[0]);assert.equal(detail.address,'Straat 1');assert.equal(detail.website,'');assert.equal(calls.length,3);
 assert.deepEqual(Object.keys(calls[1]),['schema','action','bounds','chainId','world']);
});

test('shop discovery bounds cover 10 km without following a world-sized viewport',async()=>{
 const {chainAreaBounds,CHAIN_RADIUS_METERS}=await import('../src/core/chains/ChainBrowse.js');
 const {distanceMeters}=await import('../src/core/location/GeographicBranchIndex.js');
 const center={lat:52,lng:5},[west,south,east,north]=chainAreaBounds(center);
 assert.equal(CHAIN_RADIUS_METERS,10000);
 for(const point of [{lat:south,lng:5},{lat:north,lng:5},{lat:52,lng:west},{lat:52,lng:east}])assert.ok(Math.abs(distanceMeters(center,point)-10000)<1);
 assert.ok(east-west<1);assert.ok(north-south<.5);
 assert.equal(chainAreaBounds({lat:NaN,lng:5}),null);
 assert.equal(chainAreaBounds({lat:52,lng:180}),null);
});

test('worldwide points include independent store types and use source-bound detail requests',async()=>{
 const calls=[],version='v1-'+'a'.repeat(24);
 const browse=new ChainBrowse({fetcher:async(_,options)=>{const q=JSON.parse(options.body);calls.push(q);return {ok:true,json:async()=>q.action==='map'?{schema:1,version,coverage:'WORLD',points:[['abcdef123456','',139700000,35700000,'パン屋','node/123']],kinds:{abcdef123456:'bakery'}}:{schema:1,version,detail:{id:q.id,chainId:'',sourceRef:'node/123',kind:'bakery',address:'Tokyo',openingHours:'',website:'https://example.org'}}};}});
 const {points}=await browse.area([139.6,35.6,139.8,35.8]);assert.equal(calls[0].world,true);assert.equal(points[0].kind,'bakery');assert.equal(points[0].world,true);
 const detail=await browse.detail(points[0]);assert.equal(calls[1].sourceRef,'node/123');assert.equal(calls[1].world,true);assert.equal(detail.address,'Tokyo');
});

test('an unavailable world service falls back to the working Dutch register and backs off retries',async()=>{
 const calls=[],version='v1-'+'a'.repeat(24),browse=new ChainBrowse({fetcher:async(_,options)=>{
  const q=JSON.parse(options.body);calls.push(q);
  if(q.world)return {ok:false,status:503};
  return {ok:true,json:async()=>({schema:1,version,coverage:'NL',points:[['branch000001','Q1653985',5000000,52000000,'Winkel','node/1']]})};
 }});
 const result=await browse.area([4.9,51.9,5.1,52.1]);assert.equal(result.points.length,1);assert.equal(result.points[0].world,false);assert.match(result.message,/Nederlandse/);
 await browse.area([5,52,5.2,52.2]);assert.equal(calls.filter(q=>q.world).length,1);
 await assert.rejects(browse.area([139.6,35.6,139.8,35.8]),/wereldwijde/);
});

test('cancelling worldwide discovery never launches a fallback request',async()=>{
 const controller=new AbortController();let calls=0;
 const browse=new ChainBrowse({fetcher:async()=>{calls++;controller.abort();throw new DOMException('Aborted','AbortError');}});
 await assert.rejects(browse.area([4.9,51.9,5.1,52.1],'',controller.signal));assert.equal(calls,1);
});
