// Sharon Skelet: module-neutral object relations, lifecycle and deterministic demo workspace.
// The demo never writes into the production 'objects' store.
export const SKELETON_MODULES = Object.freeze(['environment','locations','cards','persons','objects','rides','tasks','actions']);
export const SKELETON_DEMO_KEY = 'skeleton.demo.enabled';
export const SKELETON_DEMO_DATA_KEY = 'skeleton.demo.dataset';
export const SKELETON_VERSION = 1;
const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{12}$/.test(id);
const baseObjects = Object.freeze([
  {id:'DemoEnv00001',module:'environment',title:'Voorbeeldomgeving',status:'active',fields:{type:'kaartweergave'}},
  {id:'DemoPlace001',module:'locations',title:'Voorbeeldwinkel',status:'active',fields:{type:'winkel'}},
  {id:'DemoCard0001',module:'cards',title:'Voorbeeldpas',status:'active',fields:{type:'klantenpas'}},
  {id:'DemoPerson01',module:'persons',title:'Voorbeeldpersoon',status:'active',fields:{}},
  {id:'DemoObject01',module:'objects',title:'Voorwerp',status:'active',fields:{}},
  {id:'DemoRide0001',module:'rides',title:'Voorbeeldrit',status:'active',fields:{}},
  {id:'DemoTask0001',module:'tasks',title:'Voorbeeldtaak',status:'active',fields:{}},
  {id:'DemoAction01',module:'actions',title:'Voorbeeldactie',status:'active',fields:{}}
]);
const baseRelations = Object.freeze([
  {id:'DemoRel00001',from:'DemoCard0001',to:'DemoPlace001',type:'usable-at'},
  {id:'DemoRel00002',from:'DemoPerson01',to:'DemoCard0001',type:'owns'},
  {id:'DemoRel00003',from:'DemoRide0001',to:'DemoPlace001',type:'destination'}
]);
export function demoDataset() {
  return {version:SKELETON_VERSION,
    objects:baseObjects.map(o=>({...o,fields:{...o.fields}})),
    relations:baseRelations.map(r=>({...r}))};
}
export function validateSkeleton(data) {
  if (!data || data.version !== SKELETON_VERSION || !Array.isArray(data.objects) || !Array.isArray(data.relations)) throw new Error('Onjuist skeletgegevensformaat.');
  const ids=new Set();
  for (const o of data.objects) {
    if (!safeId(o.id) || ids.has(o.id) || !SKELETON_MODULES.includes(o.module)) throw new Error('Ongeldig of dubbel object-ID.');
    ids.add(o.id);
  }
  const relationIds=new Set();
  for (const r of data.relations) {
    if (!safeId(r.id) || relationIds.has(r.id) || !ids.has(r.from) || !ids.has(r.to) || r.from===r.to || typeof r.type!=='string' || !r.type.trim()) throw new Error('Ongeldige relatie.');
    relationIds.add(r.id);
  }
  return data;
}
export function relatedTo(data,id) {
  validateSkeleton(data);
  return data.relations.filter(r=>r.from===id || r.to===id);
}
export function removalAction(data,id) {
  const object=validateSkeleton(data).objects.find(o=>o.id===id);
  if(!object) return null;
  if(object.status==='archived') return 'restore';
  return relatedTo(data,id).length ? 'archive' : 'delete';
}
export function skeletonCapabilities(data,id) {
  const action=removalAction(data,id);
  if(!action) return null;
  return {edit:true,delete:action==='delete',archive:action==='archive',restore:action==='restore',
    publish:false, // Publication requires separate explicit consent and module policy.
    related:relatedTo(data,id).length};
}
export function applySkeletonAction(data,id,action) {
  validateSkeleton(data);
  if(!['archive','restore','delete'].includes(action) || removalAction(data,id)!==action) throw new Error('Actie niet toegestaan.');
  const next=structuredClone(data);
  if(action==='delete') next.objects=next.objects.filter(o=>o.id!==id);
  else next.objects.find(o=>o.id===id).status=action==='archive'?'archived':'active';
  return validateSkeleton(next);
}
export async function demoWorkspace(store) {
  const enabled=Boolean((await store.get('meta',SKELETON_DEMO_KEY))?.value);
  if(!enabled) return {enabled:false,data:null};
  const stored=(await store.get('meta',SKELETON_DEMO_DATA_KEY))?.value;
  return {enabled:true,data:validateSkeleton(stored || demoDataset())};
}
export async function setDemoEnabled(store,enabled) {
  await store.put('meta',{key:SKELETON_DEMO_KEY,value:Boolean(enabled)});
  return demoWorkspace(store);
}
export async function saveDemoDataset(store,data) {
  validateSkeleton(data);
  await store.put('meta',{key:SKELETON_DEMO_DATA_KEY,value:structuredClone(data)});
}
export async function resetDemoDataset(store) {
  await store.delete('meta',SKELETON_DEMO_DATA_KEY);
  return demoDataset();
}
