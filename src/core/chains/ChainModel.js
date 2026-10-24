import { chainById, CHAIN_CACHE_KEY } from './ChainCatalog.js?v=0.3.90';
import { IdentifierService } from '../ids/IdentifierService.js?v=0.3.90';
import { environmentBoundsForId, isEnvironmentId } from '../location/EnvironmentIdentifier.js?v=0.3.90';
import { createBranchIndex, nearbyBranches, distanceMeters } from '../location/GeographicBranchIndex.js?v=0.3.90';

export function decodeBranch(row, chainId) {
  // Compact schema: stable Sharon ID, OSM type/id, cell, microdegrees or null,
  // title, address, status, OSM version/timestamp. No personal data.
  if (!Array.isArray(row) || row.length !== 11 || !IdentifierService.isValid(row[0]) ||
      !/^(node|way|relation)\/[1-9][0-9]*$/.test(row[1]) ||
      typeof row[2] !== 'string' || row[2].length !== 6 || !isEnvironmentId(row[2]) ||
      !['active','possibly-closed'].includes(row[7]) || !chainById(chainId)) throw Error('Ongeldige vestigingsgegevens.');
  const hasPoint = row[3] !== null || row[4] !== null;
  if (hasPoint && (!Number.isInteger(row[3]) || !Number.isInteger(row[4]) || Math.abs(row[3])>90000000 || Math.abs(row[4])>180000000)) throw Error('Ongeldige winkelpositie.');
  if (![row[5],row[6],row[9],row[10]].every(value=>typeof value==='string') || row[5].length>300 || row[6].length>500 || row[10].length>300 || !Number.isInteger(row[8]) || row[8]<1) throw Error('Ongeldige brongegevens.');
  return {id:row[0],chainId,sourceRef:row[1],area:row[2],coordinates:hasPoint?{lat:row[3]/1e6,lng:row[4]/1e6}:null,
    name:row[5],address:row[6],status:row[7],sourceVersion:row[8],sourceTimestamp:row[9],openingHours:row[10]};
}
export function branchZone(branch) {
  const bounds=environmentBoundsForId(branch.area), center=bounds.center;
  const corners=[{lat:bounds.south,lng:bounds.west},{lat:bounds.north,lng:bounds.east}];
  return {center,radiusM:Math.ceil((Math.max(...corners.map(point=>distanceMeters(center,point)))+20)/10)*10};
}
export async function localBranches(store, chainId = '') {
  const cached=(await store.get('meta',CHAIN_CACHE_KEY))?.value || {chains:{}};
  return Object.entries(cached.chains || {}).filter(([id])=>!chainId || chainId===id)
    .flatMap(([id,data])=>data.rows.map(row=>decodeBranch(row,id)));
}
export async function cardContextObjects(store) {
  const objects=await store.getAll('objects');
  const relevant=new Set(objects.filter(item=>item.type==='card'&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived').map(item=>item.chainId).filter(Boolean));
  let branches=[];try{branches=await localBranches(store);}catch{return objects;}
  return [...objects,...branches.filter(branch=>relevant.has(branch.chainId)).map(branch=>({...branch,type:'chain-branch'}))];
}
const indexes = new WeakMap();
export function matchingChainBranches(objects, card, point) {
  if (!card.chainId || !chainById(card.chainId) || Number(point?.accuracy)>2000) return [];
  let cache=indexes.get(objects);if(!cache){cache=new Map();indexes.set(objects,cache);}
  if(!cache.has(card.chainId)) {
    const own=new Map(objects.filter(item=>item.type==='location'&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived'&&item.data?.personalZone===true&&item.data?.chainId===card.chainId)
      .map(item=>[item.data.branchId,item]));
    const entries=objects.filter(item=>item.type==='chain-branch'&&item.chainId===card.chainId&&(item.status==='active'||own.has(item.id))).flatMap(branch=>{
      const zone=own.get(branch.id), coarse=branchZone(branch), center=zone?.data?.coordinates || coarse.center;
      const radiusM=zone?Number(zone.data.radiusM):coarse.radiusM;
      if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng) || !Number.isFinite(radiusM) || radiusM<20 || radiusM>2000) return [];
      const place=zone || {id:branch.id,type:'location',data:{title:branch.name||chainById(branch.chainId).name,
        coordinates:center,radiusM,chainId:branch.chainId,branchId:branch.id,address:branch.address,source:'openstreetmap'}};
      return [{...center,branch,location:place,radiusM,reason:zone?'personal-chain-zone':'coarse-chain-zone'}];
    });
    cache.set(card.chainId,{index:createBranchIndex(entries),radius:Math.max(0,...entries.map(item=>item.radiusM))});
  }
  const cached=cache.get(card.chainId),accuracy=Math.max(0,Number(point.accuracy)||0);
  return nearbyBranches(cached.index,point,cached.radius+accuracy).flatMap(({branch:item,distanceMeters:distanceM})=>
    distanceM<=item.radiusM+accuracy?[{branch:item.branch,location:item.location,distanceM,reason:item.reason}]:[]);
}
export async function saveBranchLocation(store, branch, {point=null,radiusM=100,personal=false} = {}) {
  const coordinates=point || branch.coordinates;
  if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng) || Math.abs(coordinates.lat)>90 || Math.abs(coordinates.lng)>180 || !Number.isFinite(radiusM) || radiusM<20 || radiusM>2000) throw Error('Geldige positie en straal nodig.');
  const make=old=>{
    const at=new Date().toISOString();
    return {...old,id:old?.id||IdentifierService.create(),type:'location',createdAt:old?.createdAt||at,updatedAt:at,
      data:{...old?.data,title:old?.data?.title||branch.name||chainById(branch.chainId)?.name||'Winkel',kind:old?.data?.kind||chainById(branch.chainId)?.kind||'shop',
        address:old?.data?.address||branch.address,coordinates:old?.data?.coordinates || {...coordinates},radiusM:old?.data?.radiusM || radiusM,
        ...(personal?{coordinates:{...coordinates},radiusM,personalZone:true}:{}),chainId:branch.chainId,branchId:branch.id,
        source:'openstreetmap',sourceRef:branch.sourceRef}};
  };
  if (store.upsertBranchLocation) return store.upsertBranchLocation(branch.id,make);
  const old=(await store.getAll('objects')).find(item=>item.type==='location'&&!item.deletedAt&&item.data?.branchId===branch.id);
  const record=make(old);await store.put('objects',record);return record;
}
