import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardDeck,cardDetailPages} from '../src/core/cards/CardDeck.js';

test('compact deck follows list order; expanded deck stays within one pass',()=>{
  const a={id:'a',name:'A'},b={id:'b',name:'B',fields:Array.from({length:9},(_,i)=>({label:'Veld '+i,value:'Waarde '+i}))};
  const deck=createCardDeck(a,[a,b,{id:'removed',deletedAt:1}]);
  assert.equal(deck.swipe(-1).card.id,'a');
  assert.equal(deck.swipe(1).card.id,'b');
  assert.equal(deck.swipe(1).card.id,'b');
  assert.equal(deck.expand(true).pages.length,3);
  assert.equal(deck.swipe(1).page,1);
  assert.equal(deck.swipe(1).page,2);
  assert.equal(deck.swipe(1).page,2);
  assert.equal(deck.state.card.id,'b');
  deck.expand(false);
  assert.equal(deck.swipe(-1).card.id,'a');
  assert.equal(deck.expand(true).page,0);
  assert.equal(deck.swipe(1).card.id,'a');
});

test('long details split without losing text; selected record remains fresh',()=>{
  const value='Abcd '.repeat(400),card={id:'a',name:'Updated',locationId:'missing',fields:[{label:'Voorwaarden',value}]};
  const pages=cardDetailPages(card);
  assert.equal(pages.flat().filter(row=>row.label.startsWith('Voorwaarden')).map(row=>row.value).join(''),value);
  assert.equal(pages[0][0].value,'Locatie niet beschikbaar');
  assert.equal(createCardDeck(card,[{id:'a',name:'Stale'}]).state.card.name,'Updated');
  assert.deepEqual(cardDetailPages({id:'empty'}),[[]]);
});
