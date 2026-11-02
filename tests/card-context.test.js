import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestCards } from '../src/core/location/CardContext.js';
const now = 1_000_000;
const point = {lat:52,lng:6,accuracy:10,at:now};
const place = {id:'shop',type:'location',data:{title:'Winkel',coordinates:{lat:52,lng:6},radiusM:100}};
const card = {id:'card',type:'card',name:'Winkelpas',locationId:'shop'};
test('aankomst en overlappende GPS-onzekerheid geven een gekoppelde pas, duidelijk vertrek niet', () => {
  assert.equal(suggestCards([place,card],point,now)[0].card.id,'card');
  assert.deepEqual(suggestCards([place,card],{...point,lat:53},now),[]);
  assert.equal(suggestCards([place,card],{...point,accuracy:101},now)[0].card.id,'card');
  assert.deepEqual(suggestCards([place,card],{...point,lat:53,accuracy:101},now),[]);
  for (const at of [now-120_000, now+1, undefined]) assert.deepEqual(suggestCards([place,card],{...point,at},now),[]);
  for (const lat of [null, undefined, NaN, 91]) assert.deepEqual(suggestCards([place,card],{...point,lat},now),[]);
});
test('meerdere passende passen blijven beschikbaar zonder namen te raden', () => {
  const other = {...card,id:'other',name:'Andere pas'};
  assert.equal(suggestCards([place,card,other,{...card,id:'unlinked',locationId:null}],point,now).length,2);
  for (const hidden of [{deletedAt:1},{archivedAt:1},{status:'archived'}]) {
    assert.deepEqual(suggestCards([place,{...card,...hidden}],point,now),[]);
    assert.deepEqual(suggestCards([{...place,...hidden},card],point,now),[]);
  }
});
test('sublocaties erven coördinaten; ontbrekende of cyclische locaties leveren niets op', () => {
  const child={id:'child',type:'location',data:{parentId:'shop'}};
  assert.equal(suggestCards([place,child,{...card,locationId:'child'}],point,now).length,1);
  assert.deepEqual(suggestCards([card],point,now),[]);
  assert.deepEqual(suggestCards([{...place,data:{parentId:'shop'}},card],point,now),[]);
});

test('alleen nauwkeurig en recent bevestigd vertrek telt als een nieuw bezoek', async () => {
  const {hasLeftCardLocation}=await import('../src/core/location/CardContext.js');
  assert.equal(hasLeftCardLocation([place,card],'card',{...point,lat:53},now),true);
  assert.equal(hasLeftCardLocation([place,card],'card',{...point,lat:52.001,accuracy:500},now),false);
  assert.equal(hasLeftCardLocation([place,card],'card',{...point,lat:53,at:now-120001},now),false);
  assert.equal(hasLeftCardLocation([place,card],'card',point,now),false);
});
