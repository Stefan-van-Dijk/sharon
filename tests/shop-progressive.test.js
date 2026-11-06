import test from 'node:test';
import assert from 'node:assert/strict';
import {ChainBrowse,shopAreaPlan} from '../src/core/chains/ChainBrowse.js';
const bounds=[4.395,51.215,4.425,51.245];
test('small boxes cover the viewport exactly and wide views stay explicitly incomplete',()=>{
 const plan=shopAreaPlan(bounds);assert.equal(plan.incomplete,false);
 const area=plan.boxes.reduce((sum,b)=>sum+(b[2]-b[0])*(b[3]-b[1]),0);
 assert.ok(Math.abs(area-(bounds[2]-bounds[0])*(bounds[3]-bounds[1]))<1e-10);
 for(const b of plan.boxes){assert.ok(b[2]-b[0]<=0.020000001);assert.ok(b[3]-b[1]<=0.020000001);assert.ok(b[0]>=bounds[0]&&b[2]<=bounds[2]&&b[1]>=bounds[1]&&b[3]<=bounds[3]);}
 const wide=shopAreaPlan([4.3,51.1,4.5,51.3]);assert.equal(wide.boxes.length,9);assert.equal(wide.incomplete,true);
});
test('progress arrives before completion, requests are sequential, covering cells are reused',async()=>{
 let requests=0,active=0;const progress=[];
 const browse=new ChainBrowse({requestIntervalMs:0,fetcher:async(_url,options)=>{
  assert.equal(active++,0);requests++;await Promise.resolve();active--;
  const {bounds:b}=JSON.parse(options.body);
  return {ok:true,json:async()=>({schema:1,version:'v1-'+'a'.repeat(24),coverage:'WORLD',truncated:false,points:[['point0000001','',Math.round(b[0]*1e6),Math.round(b[1]*1e6),'Bakker','node/1']]})};
 }});
 const result=await browse.progressiveArea(bounds,'',undefined,p=>progress.push(p));
 assert.ok(progress.length>1);assert.equal(progress[0].loading,true);assert.equal(progress.at(-1).loading,false);assert.equal(result.points.length,1);
 const count=requests;await browse.progressiveArea(bounds);assert.equal(requests,count);
});
test('cancellation stops remaining cells and failed cells are not recorded as complete',async()=>{
 const controller=new AbortController();let calls=0;
 const browse=new ChainBrowse({requestIntervalMs:0});
 browse.area=async()=>{calls++;return {points:[],truncated:false};};
 await assert.rejects(browse.progressiveArea(bounds,'',controller.signal,()=>controller.abort()),{name:'AbortError'});assert.equal(calls,1);
 const failing=new ChainBrowse({requestIntervalMs:0,fetcher:async()=>{throw Error('Offline');}});
 await assert.rejects(failing.progressiveArea(bounds));assert.equal(failing.areas.length,0);
});
test('dense areas stop at 2000 unique points and never claim complete viewport coverage',async()=>{
 let calls=0;const browse=new ChainBrowse({requestIntervalMs:0});
 browse.area=async()=>{calls++;return {truncated:false,points:Array.from({length:2000},(_,i)=>({sourceRef:'node/'+i}))};};
 const result=await browse.progressiveArea(bounds);
 assert.equal(calls,1);assert.equal(result.points.length,2000);assert.equal(result.incomplete,true);
});
