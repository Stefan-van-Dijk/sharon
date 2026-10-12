import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.2.20';

const defaults = {
  here: ['Je bent bij [Naam] — [Type].','Aangekomen bij [Naam] — [Type].','[Naam] — [Type]. Je bent er.'],
  near: ['[Naam] — [Type] — is vlakbij.','Je bent bijna bij [Naam] — nog [Afstand].'],
  away: ['[Naam] — [Type] — ligt [Afstand] hiervandaan.','Je bent ongeveer [Afstand] van [Naam].','Vanaf hier is het ongeveer [Afstand] naar [Naam].']
};

export function distanceSituation(point,current,radiusM=100,now=Date.now()){
  if(!point||!current||!Number.isFinite(Number(current.at))||now-Number(current.at)>600000)return {state:'unknown',meters:null};
  const meters=distanceBetween(point,{lat:Number(current.lat),lng:Number(current.lng)});
  if(!Number.isFinite(meters))return {state:'unknown',meters:null};
  const accuracy=Math.max(0,Number(current.accuracy)||0),radius=Math.max(20,Number(radiusM)||100);
  if(meters+accuracy<=radius)return {state:'here',meters};
  if(meters<=radius+accuracy||meters<=radius*3)return {state:'near',meters};
  return {state:'away',meters};
}
export function formatDistance(meters){
  return meters<1000?Math.max(10,Math.round(meters/10)*10)+' m':(meters/1000).toLocaleString('nl-NL',{maximumFractionDigits:1})+' km';
}
export function resolveSentenceVariants({state,typeId,locationId,library={}}){
  const base=[...(defaults[state]||[])];
  const group=library.groups?.[typeId]?.[state]||[];
  const local=library.locations?.[locationId]||{};
  const excluded=new Set(local.excluded?.[state]||[]);
  return [...base,...group,...(local.added?.[state]||[])].filter((v,i,a)=>v&&!excluded.has(v)&&a.indexOf(v)===i);
}
export function renderLocationSentence({name,typeLabel,typeId,locationId,point,current,radiusM,library,lastSentence=''}) {
  const situation=distanceSituation(point,current,radiusM);
  if(situation.state==='unknown')return String(name||'Deze plek')+' — '+String(typeLabel||'plek')+'.';
  const choices=resolveSentenceVariants({state:situation.state,typeId,locationId,library});
  let candidates=choices.filter(x=>x!==lastSentence); if(!candidates.length)candidates=choices;
  const template=candidates[Math.floor(Math.random()*Math.max(1,candidates.length))]||'[Naam] — [Type].';
  return template.split('[Naam]').join(String(name||'deze plek')).split('[Type]').join(String(typeLabel||'plek')).split('[Afstand]').join(formatDistance(situation.meters));
}
export function updateGroupVariant(library,typeId,state,template){
  const next=structuredClone(library||{}); next.groups??={}; next.groups[typeId]??={}; next.groups[typeId][state]??=[];
  if(!next.groups[typeId][state].includes(template))next.groups[typeId][state].push(template); return next;
}
export function setLocationVariantExcluded(library,locationId,state,template,excluded=true){
  const next=structuredClone(library||{}); next.locations??={}; next.locations[locationId]??={}; next.locations[locationId].excluded??={}; next.locations[locationId].excluded[state]??=[];
  const set=new Set(next.locations[locationId].excluded[state]); excluded?set.add(template):set.delete(template); next.locations[locationId].excluded[state]=[...set]; return next;
}
export function addLocationVariant(library,locationId,state,template){
  const next=structuredClone(library||{}); next.locations??={}; next.locations[locationId]??={}; next.locations[locationId].added??={}; next.locations[locationId].added[state]??=[];
  if(!next.locations[locationId].added[state].includes(template))next.locations[locationId].added[state].push(template); return next;
}

export function removeLocationVariant(library,locationId,state,template){
  const next=structuredClone(library||{});
  const values=next.locations?.[locationId]?.added?.[state];
  if(Array.isArray(values))next.locations[locationId].added[state]=values.filter(value=>value!==template);
  return next;
}
export function removeGroupVariant(library,typeId,state,template){
  const next=structuredClone(library||{});
  const values=next.groups?.[typeId]?.[state];
  if(Array.isArray(values))next.groups[typeId][state]=values.filter(value=>value!==template);
  return next;
}
