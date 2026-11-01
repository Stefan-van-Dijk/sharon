import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnvironmentBoardSources} from '../src/ui/EnvironmentBoardSources.js';

test('all enabled filtered sources share navigation and ordering, including future sources with colliding IDs', () => {
  const values = new Map();
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = {getItem:key=>values.get(key) || null};
  try {
    values.set('sharon.boards.order.v1',JSON.stringify('nearby'));
    const wiki={id:'same',geometry:{coordinates:[5,52.001]},properties:{wikidata:'Q1'}};
    const shop={id:'same',sourceRef:'node/1',coordinates:{lat:52.002,lng:5}};
    const future={id:'same',geometry:{coordinates:[5,52.003]},properties:{source:'future'}};
    const hidden={id:'hidden',coordinates:{lat:52,lng:5}};
    let active, navigation, shopEnabled=true, selected=[shop], custom;
    const sources=createEnvironmentBoardSources({onOpen:(item,nav)=>{active=item;navigation=nav;}});
    sources.register({getBoards:()=>[wiki]});
    sources.register({getBoards:()=>shopEnabled?selected:[],openBoard:(item,nav)=>{custom={item,nav};}});
    const removeFuture=sources.register({getBoards:()=>[future]});
    assert.deepEqual(sources.getBoards(),[wiki,shop,future]);
    assert.ok(!sources.getBoards().includes(hidden));
    sources.show(shop,{lat:52,lng:5});
    assert.equal(active,shop);
    assert.equal(sources.openBoard(shop,navigation),true);
    assert.equal(custom.item,shop);
    custom.nav.onNext();assert.equal(active,future);
    navigation.onNext();assert.equal(active,wiki);
    navigation.onPrevious();assert.equal(active,future);
    // Map movement/source refresh must not replace the deck being browsed.
    selected=[];
    navigation.onPrevious();assert.equal(active,shop);
    // Reopening applies current filters and source toggles.
    shopEnabled=false;
    sources.show(wiki,{lat:52,lng:5});
    navigation.onNext();assert.equal(active,future);
    removeFuture();sources.show(wiki,{lat:52,lng:5});
    assert.equal(navigation.onNext,null);assert.equal(navigation.onPrevious,null);
    assert.equal(sources.openBoard(wiki,navigation),false);
  } finally {globalThis.localStorage=oldStorage;}
});

test('an open mixed deck reorders on the next swipe without changing its original distance origin',()=>{
  const oldStorage=globalThis.localStorage;
  let mode='nearby';globalThis.localStorage={getItem:key=>key==='sharon.boards.order.v1'?JSON.stringify(mode):key.endsWith('Q1')?'{"read":true}':null};
  try {
    const wiki={id:'Q1',properties:{wikidata:'Q1'},geometry:{coordinates:[5,52.001]}};
    const shop={id:'B',sourceRef:'node/2',coordinates:{lat:52.002,lng:5}};
    const future={id:'C',properties:{source:'future'},geometry:{coordinates:[5,52.003]}};
    let active,nav;
    const sources=createEnvironmentBoardSources({onOpen:(item,navigation)=>{active=item;nav=navigation;}});
    sources.register({getBoards:()=>[wiki,shop,future]});sources.show(shop,{lat:52,lng:5});
    mode='discover';nav.onPrevious();assert.equal(active,wiki);
    nav.onNext();assert.equal(active,shop);
  }finally{globalThis.localStorage=oldStorage;}
});

test('discovery mode appends refreshed source boards without duplicates and remains fixed for the session',()=>{
 const old=globalThis.localStorage;let explore=true;
 globalThis.localStorage={getItem:key=>key==='sharon.boards.discover-while-browsing.v1'?JSON.stringify(explore):null};
 try{
  let active,nav;const first={id:'first',coordinates:{lat:52,lng:5}},second={id:'second',coordinates:{lat:52.001,lng:5}};let selected=[first];
  const deck=createEnvironmentBoardSources({onOpen:(item,navigation)=>{active=item;nav=navigation;}});
  deck.register({getBoards:()=>selected});deck.show(first,{lat:52,lng:5});assert.equal(typeof nav.onNext,'function');
  selected=[{...first},second];nav.onNext();assert.equal(active.id,'second');nav.onNext();assert.equal(active.id,'first');
  explore=false;selected=[second,{id:'third',coordinates:{lat:52.002,lng:5}}];nav.onPrevious();assert.equal(active.id,'third','existing session retains its discovery choice');
  deck.show(first,{lat:52,lng:5});selected.push({id:'fourth',coordinates:{lat:52.003,lng:5}});
  for(let i=0;i<6;i++){nav.onNext();assert.notEqual(active.id,'fourth','new fixed session excludes later results');}
 }finally{globalThis.localStorage=old;}
});

test('both modes remove excluded boards, update refreshed records, and close an empty selection',()=>{
 const old=globalThis.localStorage;
 try{for(const explore of [false,true]){
  globalThis.localStorage={getItem:key=>key==='sharon.boards.discover-while-browsing.v1'?JSON.stringify(explore):null};
  let nav,active,closed=0,allowed=new Set(['A','B']);let records=[{id:'A',coordinates:{lat:52,lng:5}},{id:'B',name:'old',coordinates:{lat:52.001,lng:5}}];
  const deck=createEnvironmentBoardSources({onOpen:(item,navigation)=>{active=item;nav=navigation;},onEmpty:()=>closed++});
  deck.register({getBoards:()=>records,acceptsBoard:item=>allowed.has(item.id)});deck.show(records[0],{lat:52,lng:5});
  records=[{...records[1],name:'updated'}];allowed.delete('A');nav.onNext();assert.equal(active.id,'B');assert.equal(active.name,'updated');
  allowed.clear();nav.onNext?.();
  if(!explore){deck.show(records[0],{lat:52,lng:5}); /* initially single fixed board has no swipe */}
  if(explore)assert.equal(closed,1);
 }}finally{globalThis.localStorage=old;}
});
