import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ObjectStore } from '../src/core/storage/ObjectStore.js';
import { InformationFeedbackService } from '../src/core/information/InformationFeedbackService.js';
import { informationReference, informationKey, informationRank, wikipediaReference, distanceMeters } from '../src/core/information/InformationItem.js';

const wiki = informationReference({source:'wikipedia',id:'Q42'});
async function fixture() {
  globalThis.indexedDB = new IDBFactory();
  const store = new ObjectStore(); await store.open();
  const device = {personId:'abcdefghijkl',registered:false,self:{line:0}};
  const requests = [];
  const connection = {device:async()=>device, request:async(action,input)=>{
    requests.push({action,input});
    return {accepted:true,version:input.version+1,item:{reference:input.item,counts:{liked:Number(input.state.liked)}}};
  }};
  const service = new InformationFeedbackService(store,connection);
  return {store,device,requests,connection,service};
}
const queued = async store => (await store.getAll('meta')).filter(row=>row.key.startsWith('information.feedback.'));

test('source namespace, canonical Wikipedia URI and optional location are independent',()=>{
  assert.equal(wiki.uri,'https://www.wikidata.org/entity/Q42');
  assert.equal(informationKey(wikipediaReference({id:'Q42'})),informationKey(wiki));
  const web=informationReference({source:'web',id:'Q42',uri:'https://example.com/story'});
  assert.notEqual(informationKey(web),informationKey(wiki));
  assert.throws(()=>informationReference({source:'web',id:'x',uri:'javascript:alert(1)'}));
  assert.throws(()=>informationReference({source:'wikipedia',id:'42'}));
  assert.equal(distanceMeters(null,{lat:1,lng:1}),null);
  assert.equal(distanceMeters({lat:52,lng:5},{lat:52,lng:5}),0);
});
test('popularity cannot expand the configured radius, including zero radius',()=>{
  const item={policy:{baseRadius:500,maxRadius:2000,weight:0.5},counts:{liked:100,opened:100}};
  assert.equal(informationRank(item,501,'popular'),-Infinity);
  assert.ok(Number.isFinite(informationRank(item,500)));
  assert.ok(Number.isFinite(informationRank(item,null)));
  assert.equal(informationRank({...item,policy:{baseRadius:0,maxRadius:0,weight:0}},1),-Infinity);
  assert.ok(informationRank(item,100)>informationRank({...item,counts:{liked:0,opened:100}},100));
});
test('offline like then unlike persists the latest state and synchronizes once',async()=>{
  const {store,device,requests,service}=await fixture();
  await service.set(wiki,{liked:true}); await service.flush();
  await service.set(wiki,{liked:false}); await service.flush();
  assert.equal(requests.length,0);
  assert.equal((await queued(store))[0].value.state.liked,false);
  device.registered=true;
  await service.flush();
  assert.equal(requests.length,1); assert.equal(requests[0].input.state.liked,false);
  assert.equal((await queued(store))[0].value.dirty,false);
  await service.flush(); assert.equal(requests.length,1);
});
test('lost response retries the same operation, while queued state survives reload',async()=>{
  const {store,device,connection,service}=await fixture();
  await service.set(wiki,{liked:true}); await service.flush(); device.registered=true;
  let operation;
  connection.request=async(action,input)=>{operation=input.operation;throw Error('offline');};
  await service.flush(); assert.equal((await queued(store))[0].value.dirty,true);
  const restarted=new InformationFeedbackService(store,{device:connection.device,request:async(action,input)=>{
    assert.equal(input.operation,operation);
    return {accepted:true,version:1,item:{reference:wiki}};
  }});
  await restarted.flush(); assert.equal((await queued(store))[0].value.dirty,false);
});
test('delayed acknowledgement cannot erase a newer unlike',async()=>{
  const {store,device,connection,service}=await fixture();
  await service.set(wiki,{liked:true}); await service.flush(); device.registered=true;
  let release, started;
  const sent=new Promise(resolve=>{started=resolve;});
  connection.request=async()=>{started();return new Promise(resolve=>{release=resolve;});};
  const sending=service.flush(); await sent;
  await service.set(wiki,{liked:false});
  release({accepted:true,version:1,item:{reference:wiki}}); await sending;
  const row=(await queued(store))[0].value;
  assert.equal(row.state.liked,false);assert.equal(row.dirty,true);assert.equal(row.version,1);
});
test('version conflict rebases the queued intent without discarding it',async()=>{
  const {store,device,connection,service}=await fixture();
  await service.set(wiki,{liked:false}); await service.flush();device.registered=true;
  connection.request=async()=>({accepted:false,version:3,item:{reference:wiki}});
  await service.flush();
  let row=(await queued(store))[0].value;assert.equal(row.version,3);assert.equal(row.dirty,true);
  connection.request=async(action,input)=>{
    assert.equal(input.version,3);assert.equal(input.state.liked,false);
    return {accepted:true,version:4,item:{reference:wiki}};
  };
  await service.flush(); row=(await queued(store))[0].value;assert.equal(row.dirty,false);
});
test('existing Wikipedia feedback is imported once, with no fabricated opens',async()=>{
  const {store,service}=await fixture();
  const storage={length:1,key:()=> 'sharon.wiki.feedback.v1:Q42',getItem:()=>JSON.stringify({liked:true,read:true,hidden:true})};
  await service.migrateWikipedia(storage); await service.flush();
  assert.deepEqual((await queued(store))[0].value.state,{opened:false,read:true,liked:true,disliked:false});
  await service.set(wiki,{liked:false});await service.flush();
  await service.migrateWikipedia(storage);await service.flush();
  assert.equal((await queued(store))[0].value.state.liked,false);
});

test('an older summary arriving after a successful write cannot restore stale counts or state',async()=>{
  const {store,device,connection,service}=await fixture(); device.registered=true;
  let release, started;
  const waiting=new Promise(resolve=>{started=resolve;});
  connection.request=async(action,input)=>{
    if(action==='information-summary'){started();return new Promise(resolve=>{release=resolve;});}
    return {accepted:true,version:1,item:{reference:wiki,revision:2,version:1,counts:{liked:1},own:input.state}};
  };
  const loading=service.load([wiki]);await waiting;
  await service.set(wiki,{liked:true});await service.flush();
  release({items:[{reference:wiki,revision:1,version:0,counts:{liked:0},own:{liked:false}}]});
  await loading;
  assert.equal(service.summary(wiki).counts.liked,1);
  assert.equal((await queued(store))[0].value.state.liked,true);
});
