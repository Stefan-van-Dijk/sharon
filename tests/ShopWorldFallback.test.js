import test from 'node:test';
import assert from 'node:assert/strict';
import { ChainBrowse } from '../src/core/chains/ChainBrowse.js';

const bounds=[5,52,5.002,52.002];
const osm={elements:[{type:'node',id:123456789,tags:{shop:'bakery',name:'Testbakker'},lat:52.001,lon:5.001}]};
test('worldwide shop discovery falls back after server errors and keeps independent shops',async()=>{
  const calls=[];
  const browse=new ChainBrowse({fetcher:async(url)=>{
    calls.push(url);
    return calls.length===1?{ok:false,status:503}:{ok:true,json:async()=>osm};
  }});
  const data=await browse.area(bounds);
  assert.equal(data.points.length,1);
  assert.equal(data.points[0].name,'Testbakker');
  assert.equal(data.points[0].sourceRef,'node/123456789');
  assert.match(calls[1],/overpass/);
});
test('worldwide shop discovery falls back after invalid response payload',async()=>{
  let count=0;
  const browse=new ChainBrowse({fetcher:async()=>{
    count++;
    return {ok:true,json:async()=>count===1?{schema:1,version:'broken'}:osm};
  }});
  const data=await browse.area(bounds);
  assert.equal(data.points.length,1);
  assert.equal(count,2);
});
