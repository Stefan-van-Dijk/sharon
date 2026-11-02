import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardDeck,cardDetailPages,cardDistanceLabel} from '../src/core/cards/CardDeck.js';

test('continuous deck wraps in both directions through every information board',()=>{
  const a={id:'a',name:'A'},b={id:'b',name:'B',fields:Array.from({length:9},(_,i)=>({label:'Veld '+i,value:'Waarde '+i}))};
  const deck=createCardDeck(a,[a,b,{id:'removed',deletedAt:1}]);
  assert.equal(deck.state.boards.length,4);
  assert.equal(deck.swipe(-1).page,2);
  assert.equal(deck.swipe(1).card.id,'a');
  assert.equal(deck.swipe(1).card.id,'b');
  assert.equal(deck.swipe(1).page,1);
  assert.equal(deck.swipe(1).page,2);
  assert.equal(deck.swipe(1).card.id,'a');
  const single=createCardDeck(a);assert.equal(single.swipe(1).card.id,'a');assert.equal(single.swipe(-1).card.id,'a');
});

test('pill names the nearest saved place, inherits coordinates, and omits unknown labels',()=>{
  const places=[{id:'parent',data:{title:'Centrum',coordinates:{lat:52,lng:6}}},{id:'child',data:{title:'Winkel',parentId:'parent'}}];
  const card={locationId:'child'},point={lat:52,lng:6,at:1000};
  assert.equal(cardDistanceLabel(card,places,point,1000),'Winkel · 0 m');
  assert.equal(cardDistanceLabel(card,places,{...point,lat:52.01},1000),'Winkel · 1.1 km');
  assert.equal(cardDistanceLabel(card,places,point,121000),'Winkel');
  assert.equal(cardDistanceLabel(card,places,null,1000),'Winkel');
  assert.equal(cardDistanceLabel({locationId:'gone'},places,null,1000),'');
  assert.equal(cardDistanceLabel({},[],point,1000),'');
  const nearby=[...places,{id:'near',data:{title:'Station',coordinates:{lat:52.01,lng:6}}}];
  assert.equal(cardDistanceLabel(card,nearby,{...point,lat:52.01},1000),'Station · 0 m');
  assert.equal(cardDistanceLabel(card,[...places,{id:'gone',deletedAt:1,data:{title:'Weg',coordinates:{lat:52.01,lng:6}}}],{...point,lat:52.01},1000),'Winkel · 1.1 km');
});

test('long details split without losing text; missing locations remain silent',()=>{
  const value='Abcd '.repeat(400),card={id:'a',name:'Updated',locationId:'missing',fields:[{label:'Voorwaarden',value}]};
  const pages=cardDetailPages(card);
  assert.equal(pages.flat().filter(row=>row.label.startsWith('Voorwaarden')).map(row=>row.value).join(''),value);
  assert.equal(pages.flat().some(row=>row.label==='Locatie'),false);
  assert.equal(createCardDeck(card,[{id:'a',name:'Stale'}]).state.card.name,'Updated');
  assert.deepEqual(cardDetailPages({id:'empty'}),[[]]);
});
