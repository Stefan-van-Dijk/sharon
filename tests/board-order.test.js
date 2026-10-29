import test from 'node:test';
import assert from 'node:assert/strict';
import {sortBoards,boardOrderMode,markBoardOpened,BOARD_ORDER_KEY} from '../src/ui/BoardOrder.js';
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync('package.json')).version;
const {InformationFeedbackService}=await import('../src/core/information/InformationFeedbackService.js?v='+version);
import {informationKey} from '../src/core/information/InformationItem.js';

test('all four orders rank Wikipedia, shops, saved locations and external boards by the same rules',async()=>{
 const previous=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const target=new EventTarget();target.document=new EventTarget();
 const service=new InformationFeedbackService({getAll:async()=>[]},{device:async()=>({personId:'test',registered:false})});
 const stop=service.start(target);await service.ready;
 try{
  const wiki={id:'Q1',properties:{wikidata:'Q1'},geometry:{coordinates:[5,52.001]}},
   location={id:'location0001',type:'location',data:{coordinates:{lat:52.002,lng:5}}},
   shop={id:'branch000001',sourceRef:'node/1',coordinates:{lat:52.003,lng:5}},
   external={id:'tiqets-1',properties:{source:'tiqets'},geometry:{coordinates:[5,52.004]}};
  values.set('sharon.wiki.feedback.v1:Q1',JSON.stringify({read:true}));
  service.summaries.set(informationKey({source:'openstreetmap',id:'node/1',uri:'https://www.openstreetmap.org/node/1'}),{counts:{liked:9,read:10},policy:{weight:1,baseRadius:10000,maxRadius:10000}});
  const input=[external,shop,location,wiki],center={lat:52,lng:5},ids=mode=>sortBoards(input,center,mode).map(item=>item.id);
  assert.deepEqual(ids('discover'),['location0001','branch000001','tiqets-1','Q1']);
  assert.deepEqual(ids('nearby'),['Q1','location0001','branch000001','tiqets-1']);
  assert.deepEqual(ids('popular'),['branch000001','Q1','location0001','tiqets-1']);
  assert.deepEqual(ids('relevant'),['branch000001','Q1','location0001','tiqets-1']);
  assert.deepEqual(input,[external,shop,location,wiki],'sorting never mutates a source deck');
  markBoardOpened(external);assert.equal(ids('discover').at(-1),'tiqets-1');
  values.set('sharon.source.wikipedia.filters.v1',JSON.stringify({sort:'popular'}));assert.equal(boardOrderMode(),'popular');
  values.set(BOARD_ORDER_KEY,JSON.stringify('nearby'));assert.equal(boardOrderMode(),'nearby');
  values.set(BOARD_ORDER_KEY,JSON.stringify('invalid'));assert.equal(boardOrderMode(),'discover');
 }finally{stop();globalThis.localStorage=previous;}
});

test('missing or corrupt ratings stay neutral and unknown coordinates do not break a deck',()=>{
 const previous=globalThis.localStorage;globalThis.localStorage={getItem:()=>'{broken'};
 try{
  const items=[{id:'missing'},{id:'near',coordinates:{lat:52,lng:5}}];
  assert.deepEqual(sortBoards(items,{lat:52,lng:5},'popular').map(item=>item.id),['near','missing']);
  assert.equal(sortBoards(items,null,'nearby').length,2);
 }finally{globalThis.localStorage=previous;}
});
