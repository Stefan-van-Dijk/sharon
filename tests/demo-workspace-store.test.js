import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspaceStore } from '../src/core/skeleton/DemoWorkspaceStore.js';
import { demoDataset, SKELETON_DEMO_DATA_KEY, SKELETON_DEMO_KEY } from '../src/core/skeleton/SkeletonCore.js';
function fixture(data=demoDataset()) {
  const values=new Map([[SKELETON_DEMO_KEY,{value:true}],[SKELETON_DEMO_DATA_KEY,{value:data}]]);
  const store={async get(table,key){assert.equal(table,'meta');return structuredClone(values.get(key));},async put(table,value){assert.equal(table,'meta');values.set(value.key,structuredClone(value));},async delete(table,key){assert.equal(table,'meta');values.delete(key);}};
  return {values,store,workspace:createDemoWorkspaceStore(store)};
}
test('pasgegevens en locatiekoppeling worden tussen echte modules en testgraph uitgewisseld',async()=>{
  const {values,workspace}=fixture();
  const card=await workspace.get('objects','DemoCard0001');
  assert.equal(card.name,'Voorbeeldpas');assert.equal(card.locationId,'DemoPlace001');
  await workspace.put('objects',{...card,name:'Mijn pas',codeFormat:'QR_CODE',codeValue:'123',color:'#489ff8'});
  assert.equal((await workspace.get('objects',card.id)).codeValue,'123');
  assert.equal(values.get(SKELETON_DEMO_DATA_KEY).value.objects.find(o=>o.id===card.id).title,'Mijn pas');
  // Existing usable-at relation keeps its identifier during an unrelated edit.
  assert.equal(values.get(SKELETON_DEMO_DATA_KEY).value.relations.find(r=>r.type==='usable-at').id,'DemoRel00001');
  await workspace.put('objects',{...card,locationId:null});
  assert.equal((await workspace.get('objects',card.id)).locationId,null);
  await workspace.put('objects',card);
  assert.equal((await workspace.get('objects',card.id)).locationId,'DemoPlace001');
});
test('verwijderen van een gekoppelde pas archiveert en bewaart relaties',async()=>{
  const {values,workspace}=fixture();
  await workspace.delete('objects','DemoCard0001');
  assert.ok((await workspace.get('objects','DemoCard0001')).deletedAt);
  assert.equal(values.get(SKELETON_DEMO_DATA_KEY).value.relations.length,3);
  const card={id:'NewCard00001',type:'card',name:'Losse pas',locationId:null};
  await workspace.put('objects',card);await workspace.delete('objects',card.id);
  assert.equal(await workspace.get('objects',card.id),undefined);
});
test('bestaande testvoorkeuren blijven leesbaar en reset verwijdert ook de oude waarde',async()=>{
  const {values,workspace}=fixture();
  values.set('skeleton.locations.meta.locations.preferences',{key:'legacy',value:{sort:'recent'}});
  values.set('skeleton.environment.environment.camera',{key:'legacy',value:{zoom:10}});
  assert.equal((await workspace.get('meta','locations.preferences')).value.sort,'recent');
  assert.equal((await workspace.get('meta','environment.camera')).value.zoom,10);
  await workspace.delete('meta','environment.camera');
  assert.equal(await workspace.get('meta','environment.camera'),undefined);
});
test('schrijfacties voor locatie en pas blijven bij gelijktijdig opslaan beide behouden',async()=>{
  const {workspace}=fixture();
  await Promise.all([
    workspace.put('objects',{id:'NewPlace0001',type:'location',data:{title:'Nieuwe plek'}}),
    workspace.put('objects',{id:'NewCard00001',type:'card',name:'Nieuwe pas',locationId:'DemoPlace001'})
  ]);
  assert.ok(await workspace.get('objects','NewPlace0001'));
  assert.ok(await workspace.get('objects','NewCard00001'));
  assert.equal((await workspace.get('objects','DemoPerson01')).id,'DemoPerson01');
});
