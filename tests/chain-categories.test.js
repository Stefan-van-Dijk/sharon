import test from 'node:test';
import assert from 'node:assert/strict';
import {shopCategory,SHOP_CATEGORIES} from '../src/core/chains/ChainCategories.js';
import {CHAIN_CATALOG} from '../src/core/chains/ChainCatalog.js';
import {shopMatches} from '../src/ui/ChainFilters.js';
import {mountChainFilters} from '../src/ui/ChainFilters.js';
import {JSDOM} from 'jsdom';

test('shop types classify unfamiliar brands and known offline chains without name guesses',()=>{
  for(const [kind,category] of [['supermarket','groceries'],['bakery','groceries'],['clothes','fashion'],['chemist','care'],['doityourself','home'],['computer','electronics'],['sports','leisure'],['restaurant','food'],['fuel','mobility'],['bank','services'],['unknown','other']]){
    assert.equal(shopCategory({chainId:'new',name:'Onbekend' },[{id:'new',kind}]),category);
  }
  for(const chain of CHAIN_CATALOG)assert.notEqual(shopCategory({chainId:chain.id},CHAIN_CATALOG),'other');
  assert.equal(shopCategory({chainId:'Q903805',kind:'clothes'},CHAIN_CATALOG),'fashion','branch type takes precedence over generic brand fallback');
  assert.equal(shopCategory({chainId:'new',name:'Supermarket Fashion Gamma'},[]),'other');
  assert.equal(shopCategory({type:'location',data:{chainId:'new',kind:'shop'}},[{id:'new',kind:'restaurant'}]),'food','a generic saved type uses available catalogue information');
  assert.equal(shopCategory({type:'location',data:{kind:'home'}},[]),'local');
  assert.ok(Object.hasOwn(SHOP_CATEGORIES,shopCategory({chainId:'new'},[])));
});

test('unknown chain identifiers cannot break category counts',()=>{
  const dom=new JSDOM('<div><div data-chain-categories></div><div data-chain-statuses></div></div>',{url:'https://example.test'});
  const previousDocument=globalThis.document,previousStorage=globalThis.localStorage;
  globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
  const items=['constructor','__proto__','toString','unknown'].map(chainId=>({chainId}));
  const filters=mountChainFilters(dom.window.document.querySelector('div'),{getItems:()=>items,getCatalog:()=>[],onChange(){}});
  try {
    for(const item of items)assert.equal(shopCategory(item,[]),'other');
    assert.doesNotThrow(()=>filters.update());
    assert.equal(dom.window.document.querySelector('[data-chain-category="other"] b').textContent,'4');
  } finally {
    filters.destroy();dom.window.close();globalThis.document=previousDocument;globalThis.localStorage=previousStorage;
  }
});

test('shop categories and statuses use the Wikipedia selection rules and permit restoring hidden boards',()=>{
  const old=globalThis.localStorage;
  const shop={sourceRef:'node/1',kind:'supermarket'};let state={};
  globalThis.localStorage={getItem:()=>JSON.stringify(state)};
  try{
    const matches=(categories=[],statuses=[])=>shopMatches(shop,new Set(categories),new Set(statuses),[]);
    assert.equal(matches(),true);assert.equal(matches(['fashion']),false);
    assert.equal(matches(['fashion','groceries']),true);
    state={liked:true};assert.equal(matches([],['liked']),true);assert.equal(matches([],['read']),false);
    state={hidden:true,liked:true};assert.equal(matches(),false);assert.equal(matches(['groceries']),false);
    assert.equal(matches([],['liked']),false);assert.equal(matches([],['hidden']),true);
  }finally{globalThis.localStorage=old;}
});
