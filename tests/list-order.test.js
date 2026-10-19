import test from 'node:test';
import assert from 'node:assert/strict';
import { sortList, moveInOrder } from '../src/core/storage/ListOrder.js';
const items=[{id:'a',name:'Alpha',updatedAt:'2026-10-01T12:00:00Z'},{id:'b',name:'Beta',updatedAt:1791028800000},{id:'c',name:'Charlie'}];
test('recent vergelijkt ISO-datums en numerieke tijdstempels; custom bewaart bekende IDs',()=>{
  assert.deepEqual(sortList(items,{sort:'recent'}).map(i=>i.id),['b','a','c']);
  assert.deepEqual(sortList(items,{sort:'custom',order:['c','a']}).map(i=>i.id),['c','a','b']);
  assert.deepEqual(sortList(items,{sort:'near',distance:i=>({a:10,b:1,c:100}[i.id])}).map(i=>i.id),['b','a','c']);
});
test('eigen volgorde verplaatst één item zonder IDs kwijt te raken of bron te wijzigen',()=>{
  const ids=['a','b','c'];
  assert.deepEqual(moveInOrder(ids,'b',-1),['b','a','c']);
  assert.deepEqual(moveInOrder(ids,'a',-1),ids);
  assert.deepEqual(moveInOrder(ids,'missing',1),ids);
  assert.deepEqual(ids,['a','b','c']);
});
