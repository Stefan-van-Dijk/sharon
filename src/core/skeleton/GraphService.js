// Shared typed graph model. A relation is a triple: from --predicate--> to.
// Properties stay on their object. No remote/AI dependencies.
export const RELATION_TYPES=Object.freeze({
  'contains': {label:'bevat',inverse:'hoort bij'},
  'belongs-to': {label:'hoort bij',inverse:'bevat'},
  'at-location': {label:'vindt plaats bij',inverse:'locatie van'},
  'destination': {label:'heeft bestemming',inverse:'bestemming van'},
  'owns': {label:'is eigenaar van',inverse:'heeft eigenaar'},
  'usable-at': {label:'is bruikbaar bij',inverse:'heeft kaart'},
  'tracks-time': {label:'registreert tijd voor',inverse:'heeft tijdregistratie'},
  'related-to': {label:'is gerelateerd aan',inverse:'is gerelateerd aan'}
});
export function graphConnections(data,id){
  const obj=new Map(data.objects.map(o=>[o.id,o]));
  if(!obj.has(id))return [];
  return data.relations.filter(r=>r.from===id||r.to===id).map(r=>{
    const outward=r.from===id;
    const other=obj.get(outward?r.to:r.from);
    const predicate=RELATION_TYPES[r.type];
    return other?{relationId:r.id,predicate:r.type,label:outward?(predicate?.label||r.type):(predicate?.inverse||r.type),
      target:other,direction:outward?'out':'in'}:null;
  }).filter(Boolean);
}
export function addGraphRelation(data,{id,from,to,type}){
  if(!RELATION_TYPES[type])throw new Error('Onbekend relatietype.');
  if(!/^[A-Za-z0-9_-]{12}$/.test(String(id)))throw new Error('Ongeldig relatie-ID.');
  if(from===to || !data.objects.some(o=>o.id===from) || !data.objects.some(o=>o.id===to))throw new Error('Kies twee bestaande verschillende objecten.');
  if(data.relations.some(r=>r.id===id || (r.from===from&&r.to===to&&r.type===type)))throw new Error('Deze relatie bestaat al.');
  return {...data,relations:[...data.relations,{id,from,to,type}]};
}
export function removeGraphRelation(data,id){
  if(!data.relations.some(r=>r.id===id))throw new Error('Relatie bestaat niet.');
  return {...data,relations:data.relations.filter(r=>r.id!==id)};
}
export function graphNeighborhood(data,id,depth=1){
  const objects=new Map(data.objects.map(o=>[o.id,o]));
  if(!objects.has(id))return {objects:[],relations:[]};
  const visited=new Set([id]);let frontier=new Set([id]);
  for(let n=0;n<Math.max(0,Math.min(depth,3));n++){
    const next=new Set();
    for(const r of data.relations) if(frontier.has(r.from)||frontier.has(r.to)){
      if(!visited.has(r.from))next.add(r.from);
      if(!visited.has(r.to))next.add(r.to);
    }
    next.forEach(key=>visited.add(key));frontier=next;
  }
  return {objects:[...visited].map(key=>objects.get(key)),
    relations:data.relations.filter(r=>visited.has(r.from)&&visited.has(r.to))};
}
