import test from 'node:test';import assert from 'node:assert/strict';
import {buildBrowse} from '../scripts/build-chain-browse.mjs';
import {ChainBrowse} from '../src/core/chains/ChainBrowse.js';
const register={sourceTimestamp:'2026-10-24T00:00:00Z',chains:{}};
const feature=(id,brand,qid)=>({type:'Feature',properties:{'@type':'node','@id':id,shop:'bakery',brand,'brand:wikidata':qid,name:brand,opening_hours:'Mo-Sa 08:00-18:00','addr:street':'Straat','addr:housenumber':'1',website:'https://example.com'},geometry:{type:'Point',coordinates:[5,52]}});
test('national browse includes unknown brands and unlinked chains, preserves source identities and excludes offices',()=>{
 const data={type:'FeatureCollection',features:[feature(1,'Nieuwe keten','Q9876543'),feature(2,'Lokale keten'),{...feature(3,'Kantoor','Q1234'),properties:{...feature(3,'Kantoor','Q1234').properties,shop:undefined,office:'company'}}]};
 const first=buildBrowse(data,register),second=buildBrowse(data,register,first);
 assert.equal(first.chains.length,2);assert.equal(first.points.length,2);assert.equal(second.points[0][0],first.points[0][0]);
 assert.equal(first.points[0].length,6);assert.ok(!JSON.stringify(first.points).includes('08:00'));assert.ok(Object.values(first.details).some(d=>d.address==='Straat 1'));
});
test('browse catalog/points/details are separate bounded cached requests with no personal payload',async()=>{
 const calls=[],version='v1-'+'a'.repeat(24);const browse=new ChainBrowse({fetcher:async(_,options)=>{
  const q=JSON.parse(options.body);calls.push(q);assert.equal(options.credentials,'omit');
  return {ok:true,json:async()=>q.action==='catalog'?{schema:1,version,chains:[{id:'Q9876543',name:'Keten'}]}:q.action==='map'?{schema:1,version,points:[['branch000001','Q9876543',5000000,52000000,'Keten','node/1']]}:{schema:1,version,detail:{id:q.id,chainId:'Q9876543',sourceRef:'node/1',address:'Straat 1',openingHours:'',website:'javascript:alert(1)'}}};
 }});
 await browse.catalog();const {points}=await browse.area([4.9,51.9,5.1,52.1]);await browse.area([4.9,51.9,5.1,52.1]);assert.equal(calls.length,2);assert.equal(points[0].address,undefined);
 const detail=await browse.detail(points[0]);assert.equal(detail.address,'Straat 1');assert.equal(detail.website,'');assert.equal(calls.length,3);
 assert.deepEqual(Object.keys(calls[1]),['schema','action','bounds','chainId']);
});
