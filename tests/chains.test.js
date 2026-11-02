import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {ObjectStore} from '../src/core/storage/ObjectStore.js';
import {EventBus} from '../src/core/events/EventBus.js';
import {CHAIN_CATALOG,CHAIN_CACHE_KEY,CHAIN_SYNC_INTERVAL} from '../src/core/chains/ChainCatalog.js';
import {ChainSyncService} from '../src/core/chains/ChainSyncService.js';
import {decodeBranch,branchZone,saveBranchLocation,cardContextObjects} from '../src/core/chains/ChainModel.js';
import {environmentIdForPoint} from '../src/core/location/EnvironmentIdentifier.js';
import {suggestCards} from '../src/core/location/CardContext.js';
import {buildChainRegister,chainQuery} from '../scripts/update-chain-register.mjs';

const version='v1-'+'a'.repeat(24),next='v1-'+'b'.repeat(24);
export const row=(id='branch000001',chain=0,offset=0)=>[id,'node/'+(chain+1+offset),environmentIdForPoint({lat:52+offset/10000,lng:5},6),52000000+offset*100,5000000,CHAIN_CATALOG[chain].name,'Voorbeeldstraat 1','active',1,'2026-10-23T10:00:00Z','Mo-Sa 08:00-20:00'];
async function fixture(count=1){
  globalThis.indexedDB=new IDBFactory();const store=await new ObjectStore().open();
  for(let i=0;i<count;i++)await store.put('objects',{id:'card'+String(i).padStart(8,'0'),type:'card',chainId:CHAIN_CATALOG[i%3].id,name:'Pas '+i});
  return store;
}
function response(queries){return {ok:true,json:async()=>({schema:1,coverage:'NL',chains:queries.map((query,index)=>({id:query.id,version,mode:'full',from:query.version,rows:[row('branch'+String(index+1).padStart(6,'0'),CHAIN_CATALOG.findIndex(item=>item.id===query.id))],removed:[]}))})};}

test('20 cards use one version check; GPS/opening recognition is entirely local and monthly checks are bundled',async()=>{
  const store=await fixture(20),requests=[];let clock=10000000000;
  const sync=new ChainSyncService(store,{clock:()=>clock,fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);requests.push(body);assert.deepEqual(Object.keys(body),['schema','chains']);return response(body.chains);
  }});
  await sync.sync();assert.equal(requests.length,1);assert.equal(requests[0].chains.length,3);
  const objects=await cardContextObjects(store),point={lat:52,lng:5,accuracy:10,at:Date.now()};
  assert.equal(suggestCards(objects,point).length,20);
  for(let i=0;i<10;i++){suggestCards(objects,point);await sync.sync();}
  assert.equal(requests.length,1);
  clock+=CHAIN_SYNC_INTERVAL;await sync.sync();assert.equal(requests.length,2);
  await sync.sync({forceChainId:CHAIN_CATALOG[1].id});assert.equal(requests.at(-1).chains.length,1);
});
test('failed or invalid delta preserves local data, successful timestamp and personal zones',async()=>{
  const store=await fixture();let at=10000000000;
  const sync=new ChainSyncService(store,{clock:()=>at,fetcher:async(url,options)=>response(JSON.parse(options.body).chains)});
  await sync.sync();const before=(await store.get('meta',CHAIN_CACHE_KEY)).value;
  const branch=decodeBranch(before.chains.Q1653985.rows[0],'Q1653985');
  const zone=await saveBranchLocation(store,branch,{point:{lat:52,lng:5},radiusM:30,personal:true});
  at+=CHAIN_SYNC_INTERVAL;sync.fetcher=async()=>{throw Error('offline');};
  await assert.rejects(sync.sync(),/offline/);assert.deepEqual((await store.get('meta',CHAIN_CACHE_KEY)).value,before);
  sync.fetcher=async()=>({ok:true,json:async()=>({schema:1,coverage:'NL',chains:[{id:'Q1653985',mode:'delta',from:'wrong',version:next,rows:[],removed:[]}]})});
  await assert.rejects(sync.sync(),/sluit niet aan/);assert.deepEqual((await store.get('meta',CHAIN_CACHE_KEY)).value,before);
  assert.deepEqual(await store.get('objects',zone.id),zone);
});
test('unchanged response advances lastCheckedAt; delta replaces only source records',async()=>{
  const store=await fixture();let at=10000000000;
  const sync=new ChainSyncService(store,{clock:()=>at,fetcher:async(url,options)=>response(JSON.parse(options.body).chains)});
  await sync.sync();at+=CHAIN_SYNC_INTERVAL;
  sync.fetcher=async()=>({ok:true,json:async()=>({schema:1,coverage:'NL',chains:[{id:'Q1653985',mode:'unchanged',from:version,version}]})});
  await sync.sync();assert.equal((await store.get('meta',CHAIN_CACHE_KEY)).value.chains.Q1653985.lastCheckedAt,at);
  const old=(await store.get('meta',CHAIN_CACHE_KEY)).value.chains.Q1653985.rows[0],changed=[...old];changed[5]='Nieuwe bronnaam';
  sync.fetcher=async()=>({ok:true,json:async()=>({schema:1,coverage:'NL',chains:[{id:'Q1653985',mode:'delta',from:version,version:next,rows:[changed],removed:[]}]})});
  await sync.sync({forceChainId:'Q1653985'});assert.equal((await store.get('meta',CHAIN_CACHE_KEY)).value.chains.Q1653985.rows[0][5],'Nieuwe bronnaam');
});
test('personal zone suppresses only that branch; another branch in the same cell remains identifiable',()=>{
  const a=decodeBranch(row(),'Q1653985'),b={...a,id:'branch000002',sourceRef:'node/2'},point={...branchZone(a).center,accuracy:0,at:Date.now()};
  const card={id:'card00000001',type:'card',chainId:'Q1653985'},branches=[{...a,type:'chain-branch'},{...b,type:'chain-branch'}];
  const unrefined=suggestCards([card,...branches],point)[0];assert.equal(unrefined.branches.length,2);
  const own={id:'place0000001',type:'location',data:{branchId:a.id,chainId:a.chainId,personalZone:true,coordinates:{lat:52.002,lng:5},radiusM:20}};
  const result=suggestCards([card,...branches,own],point)[0];assert.equal(result.branches.length,1);assert.equal(result.branch.id,b.id);
  const withoutOther=suggestCards([card,branches[0],own],point);assert.equal(withoutOther.length,0);
});
test('unknown exact position uses the cell coverage without inventing source coordinates',()=>{
  const compact=row();compact[3]=null;compact[4]=null;
  const branch=decodeBranch(compact,'Q1653985');assert.equal(branch.coordinates,null);
  const zone=branchZone(branch);assert.ok(zone.radiusM>20);
  assert.equal(suggestCards([{id:'card00000001',type:'card',chainId:branch.chainId},{...branch,type:'chain-branch'}],{...zone.center,accuracy:10,at:Date.now()}).length,1);
});
test('concurrent saves preserve one random location ID and subsequent personal edits',async()=>{
  const store=await fixture(),branch=decodeBranch(row(),'Q1653985');
  const records=await Promise.all([saveBranchLocation(store,branch),saveBranchLocation(store,branch)]);
  assert.equal(records[0].id,records[1].id);assert.match(records[0].id,/^[A-Za-z0-9_-]{12}$/);
  const own={...records[0],data:{...records[0].data,title:'Mijn winkel'}};await store.put('objects',own);
  const refined=await saveBranchLocation(store,branch,{point:{lat:52.001,lng:5},radiusM:70,personal:true});
  assert.equal(refined.id,own.id);assert.equal(refined.data.title,'Mijn winkel');assert.equal(refined.data.radiusM,70);
});
function osmFixture(){return {osm3s:{timestamp_osm_base:'2026-10-23T10:00:00Z'},elements:CHAIN_CATALOG.flatMap((chain,index)=>[0,1].map(offset=>({type:'node',id:index*10+offset+1,version:1,timestamp:'2026-10-22T10:00:00Z',lat:52+index/100,lon:5+offset/1000,tags:{'brand:wikidata':chain.brands[0],name:chain.name,shop:'supermarket'}})))};}
test('OSM import preserves branch IDs, marks missing as possibly closed, restores them, and rejects partial responses',()=>{
  const data=osmFixture(),initial=buildChainRegister(data),same=buildChainRegister(data,initial);
  assert.equal(same.chains.Q1653985.version,initial.chains.Q1653985.version);
  const missing={...data,elements:data.elements.filter(item=>item.id!==1)},updated=buildChainRegister(missing,same);
  const former=updated.chains.Q1653985.rows.find(row=>row[1]==='node/1');assert.equal(former[7],'possibly-closed');
  const restored=buildChainRegister(data,updated);assert.equal(restored.chains.Q1653985.rows.find(row=>row[1]==='node/1')[0],former[0]);
  assert.equal(restored.chains.Q1653985.rows.find(row=>row[1]==='node/1')[7],'active');
  assert.throws(()=>buildChainRegister({...data,remark:'runtime error'},initial));
  assert.throws(()=>buildChainRegister({...data,elements:[]},initial));
  assert.match(chainQuery(),/Q77971185/);assert.match(chainQuery(),/ISO3166-1/);
});

test('possibly closed source status does not erase or override a personal zone',()=>{
 const branch={...decodeBranch(row(),'Q1653985'),status:'possibly-closed',type:'chain-branch'};
 const card={id:'card00000001',type:'card',chainId:'Q1653985'},point={lat:52,lng:5,accuracy:10,at:Date.now()};
 assert.equal(suggestCards([card,branch],point).length,0);
 const own={id:'place0000001',type:'location',data:{branchId:branch.id,chainId:branch.chainId,personalZone:true,coordinates:{lat:52,lng:5},radiusM:50}};
 assert.equal(suggestCards([card,branch,own],point).length,1);
});
