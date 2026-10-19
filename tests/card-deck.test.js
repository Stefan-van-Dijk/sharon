import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardDeck,cardDetailPages,cardDistanceLabel} from '../src/core/cards/CardDeck.js';

test('one continuous deck follows pass order and includes every information board',()=>{
  const a={id:'a',name:'A'},b={id:'b',name:'B',fields:Array.from({length:9},(_,i)=>({label:'Veld '+i,value:'Waarde '+i}))};
  const deck=createCardDeck(a,[a,b,{id:'removed',deletedAt:1}]);
  assert.equal(deck.swipe(-1).card.id,'a');
  assert.equal(deck.swipe(1).card.id,'b');
  assert.equal(deck.state.pages.length,3);
  assert.equal(deck.swipe(1).page,1);
  assert.equal(deck.swipe(1).page,2);
  assert.equal(deck.swipe(1).page,2);
  assert.equal(deck.state.card.id,'b');
  assert.equal(deck.state.boards.length,4);
  assert.equal(deck.swipe(-1).page,1);
  assert.equal(deck.swipe(-1).page,0);
  assert.equal(deck.swipe(-1).card.id,'a');
});

test('distance uses inherited coordinates and rejects old or missing GPS',()=>{
  const places=[{id:'parent',data:{coordinates:{lat:52,lng:6}}},{id:'child',data:{parentId:'parent'}}];
  const card={locationId:'child'},point={lat:52,lng:6,at:1000};
  assert.equal(cardDistanceLabel(card,places,point,1000),'0 m');
  assert.equal(cardDistanceLabel(card,places,{...point,lat:52.01},1000),'1.1 km');
  assert.equal(cardDistanceLabel(card,places,point,121000),'Afstand onbekend');
  assert.equal(cardDistanceLabel(card,places,null,1000),'Afstand onbekend');
  assert.equal(cardDistanceLabel({locationId:'gone'},places,point,1000),'Locatie onbekend');
  assert.equal(cardDistanceLabel({},places,point,1000),'Geen locatie');
});

test('long details split without losing text; selected record remains fresh',()=>{
  const value='Abcd '.repeat(400),card={id:'a',name:'Updated',locationId:'missing',fields:[{label:'Voorwaarden',value}]};
  const pages=cardDetailPages(card);
  assert.equal(pages.flat().filter(row=>row.label.startsWith('Voorwaarden')).map(row=>row.value).join(''),value);
  assert.equal(pages[0][0].value,'Locatie niet beschikbaar');
  assert.equal(createCardDeck(card,[{id:'a',name:'Stale'}]).state.card.name,'Updated');
  assert.deepEqual(cardDetailPages({id:'empty'}),[[]]);
});
