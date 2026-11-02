import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {IdentifierService} from '../src/core/ids/IdentifierService.js';
import {environmentIdForPoint} from '../src/core/location/EnvironmentIdentifier.js';

export const normalizeShopName=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('und').replace(/\s+/gu,' ').trim();
export const legacyWorldId=ref=>createHash('sha256').update('osm:'+ref).digest('hex').slice(0,12);
// Candidate generation only. Neither a shared building nor a shared brand is proof of identity.
export function duplicateEvidence(a,b){
 if(a.sourceRef===b.sourceRef)return 'same-source';
 const name=normalizeShopName(a.name);if(!name||name!==normalizeShopName(b.name)||a.countryCode!==b.countryCode)return null;
 if(a.unit!==b.unit||a.level!==b.level)return null;
 const dy=(a.lat-b.lat)*111195,dx=(a.lng-b.lng)*111195*Math.cos(a.lat*Math.PI/180);
 if(Math.hypot(dx,dy)>15)return null;
 const address=normalizeShopName(a.address),website=a.website;
 return address&&address===normalizeShopName(b.address)&&website&&website===b.website?'review-name-address-website':null;
}
export function registryState(previous){
 const state=structuredClone(previous?.registry||{organizations:{},branches:{},chainOrganizations:{}});
 const used=new Set([...Object.keys(state.organizations),...Object.keys(state.branches),...(previous?.points||[]).map(r=>r[0])]);
 const create=()=>{let id;do{id=IdentifierService.create();}while(used.has(id));used.add(id);return id;};
 return {state,create,reserve:id=>used.add(id)};
}
export function registerBranch({state,create},detail,p,countryCode,timestamp){
 const before=state.branches[detail.id];
 // Existing source assignments win over mutable names, brands and categories.
 let organizationId=before?.organizationId||state.chainOrganizations[detail.chainId];
 if(!organizationId){organizationId=create();if(detail.chainId)state.chainOrganizations[detail.chainId]=organizationId;}
 const organization=state.organizations[organizationId]||{id:organizationId,name:detail.name,tradeNames:[],type:detail.chainId?'chain':'independent',externalIds:[],parentOrganizationId:null};
 organization.tradeNames=[...new Set([...organization.tradeNames,p.brand,p.operator,p.name].filter(v=>typeof v==='string'&&v))];
 const qid=p['brand:wikidata'];if(/^Q[1-9][0-9]*$/.test(qid||'')&&!organization.externalIds.some(x=>x.id===qid))organization.externalIds.push({source:'wikidata',id:qid});
 state.organizations[organizationId]=organization;
 const branch={...before,id:detail.id,organizationId,chainId:detail.chainId,sourceRef:detail.sourceRef,
  aliases:[...new Set([...(before?.aliases||[]),legacyWorldId(detail.sourceRef)])],countryCode,
  addressParts:Object.fromEntries(Object.entries(p).filter(([k,v])=>k.startsWith('addr:')&&typeof v==='string')),
  category:detail.kind,status:'active',relationship:p.operator&&p.brand&&p.operator!==p.brand?'operator-distinct':'unspecified',
  operator:String(p.operator||''),sources:[{source:'openstreetmap',id:detail.sourceRef,version:p['@version']??null,updatedAt:p['@timestamp']??null,observedAt:timestamp,license:'ODbL-1.0'}]};
 state.branches[detail.id]=branch;return {...detail,...branch};
}
// Immutable files first, manifest last. A failed build never replaces the deployed manifest.
export function writeShopTiles(result,directory){
 mkdirSync(directory,{recursive:true});const tiles={},identities={},details={};
 for(const row of result.points){
  const key=environmentIdForPoint({lat:row[3]/1e6,lng:row[2]/1e6},4);
  (tiles[key]??=[]).push([...row,result.details[row[0]].kind]);
 }
 for(const branch of Object.values(result.registry.branches)){
  const prefix=createHash('sha256').update(branch.sourceRef).digest('hex').slice(0,2);
  (identities[prefix]??={})[branch.sourceRef]={id:branch.id,chainId:branch.chainId,organizationId:branch.organizationId,aliases:branch.aliases||[]};
 }
 for(const [id,detail] of Object.entries(result.details))(details[id.slice(0,2)]??={})[id]=detail;
 const save=(group,buckets)=>Object.fromEntries(Object.entries(buckets).map(([key,value])=>{
  const raw=JSON.stringify(value)+'\n',hash=createHash('sha256').update(raw).digest('hex'),name=group+'-'+key+'-'+hash+'.json';
  if(Buffer.byteLength(raw)>2000000)throw Error('Registertile overschrijdt 2 MB: '+key);
  writeFileSync(join(directory,name),raw);return [key,name];
 }));
 const manifest={schema:2,coverage:result.coverage,version:result.version,sourceTimestamp:result.sourceTimestamp,
  attribution:'© OpenStreetMap contributors',license:'https://opendatacommons.org/licenses/odbl/1-0/',
  chains:result.chains,tiles:save('tile',tiles),identities:save('identity',identities),details:save('detail',details)};
 writeFileSync(join(directory,'manifest.json.tmp'),JSON.stringify(manifest)+'\n');renameSync(join(directory,'manifest.json.tmp'),join(directory,'manifest.json'));
 return manifest;
}
