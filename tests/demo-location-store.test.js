import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoLocationStore } from '../src/core/skeleton/DemoLocationStore.js';
import { demoDataset, SKELETON_DEMO_KEY, SKELETON_DEMO_DATA_KEY } from '../src/core/skeleton/SkeletonCore.js';
function fixture() {
  const values=new Map([[SKELETON_DEMO_KEY,{value:true}]]);
  const store={async get(table,key){assert.equal(table,'meta');return structuredClone(values.get(key));},async put(table,value){assert.equal(table,'meta');values.set(value.key,structuredClone(value));}};
  return {values,store,adapter:createDemoLocationStore(store)};
}
test('testlocaties gebruiken de bestaande graph en bewaren volledige locatiegegevens', async()=>{
  const {values,adapter}=fixture();
  const place=await adapter.get('objects','DemoPlace001');
  assert.equal(place.data.title,'Voorbeeldwinkel');
  assert.equal(place.data.kind,'shop');
  const updated={...place,data:{...place.data,title:'Mijn testwinkel',coordinates:{lat:52,lng:6},radiusM:150,address:{city:'Zwolle'}}};
  await adapter.put('objects',updated);
  assert.deepEqual(await adapter.get('objects',place.id),updated);
  const data=values.get(SKELETON_DEMO_DATA_KEY).value;
  assert.equal(data.objects.find(o=>o.id===place.id).title,'Mijn testwinkel');
  assert.deepEqual(data.relations,demoDataset().relations);
  await adapter.put('objects',{...updated,id:'NewPlace0001',externalId:'NewPlace0001'});
  assert.equal((await adapter.getAll('objects')).filter(item=>item.type==='location').length,2);
});
test('voorkeuren, instellingen en locatieacties blijven in de testopslag',async()=>{
  const {values,adapter}=fixture();
  await adapter.put('meta',{key:'locations.preferences',value:{sort:'recent'}});
  await adapter.put('settings',{key:'app',value:{onboarding:{firstPlaceId:'DemoPlace001'}}});
  assert.equal(values.has('app'),false);
  assert.equal((await adapter.get('settings','app')).value.onboarding.firstPlaceId,'DemoPlace001');
  const action={id:'TestAction01',type:'location-action',data:{locationId:'DemoPlace001',enabled:true}};
  await adapter.put('objects',action);
  assert.deepEqual(await adapter.get('objects',action.id),action);
  await assert.rejects(adapter.put('objects',{id:'BadObject001',type:'unsupported'}),/niet ondersteund/);
});
test('verwijderen archiveert gekoppelde testlocatie en behoudt relaties; herstel blijft mogelijk',async()=>{
  const {values,adapter}=fixture();
  const place=await adapter.get('objects','DemoPlace001');
  await adapter.put('objects',{...place,deletedAt:123});
  const data=values.get(SKELETON_DEMO_DATA_KEY).value;
  assert.equal(data.objects.find(o=>o.id===place.id).status,'archived');
  assert.deepEqual(data.relations,demoDataset().relations);
  data.objects.find(o=>o.id===place.id).status='active';
  assert.equal((await adapter.get('objects',place.id)).deletedAt,null);
});
test('uitgeschakelde testomgeving weigert wijzigingen',async()=>{
  const {values,adapter}=fixture();values.set(SKELETON_DEMO_KEY,{value:false});
  await assert.rejects(adapter.put('objects',{id:'NewPlace0001',type:'location',data:{title:'Test'}}),/niet actief/);
});
