import test from 'node:test';
import assert from 'node:assert/strict';
import {shopCategory,SHOP_CATEGORIES} from '../src/core/chains/ChainCategories.js';
import {CHAIN_CATALOG} from '../src/core/chains/ChainCatalog.js';
import {shopMatches} from '../src/ui/ChainFilters.js';

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
