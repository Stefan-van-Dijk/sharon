import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHAIN_CATALOG} from '../src/core/chains/ChainCatalog.js';
import {IdentifierService} from '../src/core/ids/IdentifierService.js';
import {environmentIdForPoint} from '../src/core/location/EnvironmentIdentifier.js';
import {decodeBranch} from '../src/core/chains/ChainModel.js';

export function chainQuery(){
  const brands=CHAIN_CATALOG.flatMap(chain=>chain.brands).join('|');
  return '[out:json][timeout:90];area["ISO3166-1"="NL"]["admin_level"="2"]->.nl;nwr["shop"]["brand:wikidata"~"^('+brands+')$"](area.nl);out meta center;';
}
export function buildChainRegister(data,previous=null,at=new Date().toISOString()){
  if(data?.remark || !Array.isArray(data?.elements) || !data?.osm3s?.timestamp_osm_base)throw Error('Geen complete OSM-respons. Bestaande gegevens blijven behouden.');
  if(previous && (previous.schema!==1||previous.coverage!=='NL'))throw Error('Ongeldig vorig register.');
  const grouped=new Map(CHAIN_CATALOG.map(chain=>[chain.id,[]]));
  const assigned=new Set();
  for(const chain of Object.values(previous?.chains||{}))for(const row of chain.rows)assigned.add(row[0]);
  for(const element of data.elements){
    const chain=CHAIN_CATALOG.find(item=>item.brands.includes(element.tags?.['brand:wikidata']));
    if(!chain)continue;
    if(!/^(node|way|relation)$/.test(element.type)||!Number.isSafeInteger(element.id)||element.id<=0||!Number.isSafeInteger(element.version)||element.version<1||typeof element.timestamp!=='string')throw Error('OSM-bronreferentie ontbreekt.');
    const point=element.type==='node'?element:element.center;
    if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)throw Error('OSM-winkelpositie ontbreekt.');
    const ref=element.type+'/'+element.id;
    const prior=previous?.chains?.[chain.id]?.rows.find(row=>row[1]===ref);
    let id=prior?.[0];
    if(!id){do{id=IdentifierService.create();}while(assigned.has(id));assigned.add(id);}
    const tags=element.tags||{};
    const address=[[tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join(' '),[tags['addr:postcode'],tags['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const row=[id,ref,environmentIdForPoint({lat:point.lat,lng:point.lon},6),Math.round(point.lat*1e6),Math.round(point.lon*1e6),
      String(tags.name||chain.name).slice(0,300),address.slice(0,500),'active',element.version,element.timestamp,String(tags.opening_hours||'').slice(0,300)];
    decodeBranch(row,chain.id);grouped.get(chain.id).push(row);
  }
  const chains={};
  for(const chain of CHAIN_CATALOG){
    const current=grouped.get(chain.id),before=previous?.chains?.[chain.id];
    if(!current.length)throw Error('Geen vestigingen voor '+chain.name+'. Import afgebroken zonder oude data te wijzigen.');
    const refs=new Set(current.map(row=>row[1]));
    if(refs.size!==current.length)throw Error('Dubbele OSM-bronreferenties.');
    for(const row of before?.rows||[])if(!refs.has(row[1]))current.push(row.map((value,index)=>index===7?'possibly-closed':value));
    current.sort((a,b)=>a[0].localeCompare(b[0],'en'));
    const version='v1-'+createHash('sha256').update(JSON.stringify(current)).digest('hex').slice(0,24);
    const history=before?.version===version?before.history||[]:[...(before?[{version:before.version,rows:before.rows}]:[]),...(before?.history||[])].slice(0,3);
    chains[chain.id]={name:chain.name,version,rows:current,history};
  }
  return {schema:1,coverage:'NL',fetchedAt:at,sourceTimestamp:data.osm3s.timestamp_osm_base,
    attribution:'© OpenStreetMap contributors',license:'https://opendatacommons.org/licenses/odbl/1-0/',chains};
}
async function main(){
  const output=resolve(process.argv[2]||'server/data/chains/register-v1.json');
  const previous=existsSync(output)?JSON.parse(readFileSync(output,'utf8')):null;
  let data,lastError;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Sharon-chain-register/1.0 (https://github.com/Stefan-van-Dijk/sharon)'},body:new URLSearchParams({data:chainQuery()}),signal:AbortSignal.timeout(100000)});
      if(!response.ok)throw Error('OSM HTTP '+response.status);
      data=await response.json();if(data.remark)throw Error(data.remark);break;
    }catch(error){lastError=error;}
  }
  if(!data || data.remark)throw lastError||Error('OSM niet bereikbaar.');
  const register=buildChainRegister(data,previous);
  mkdirSync(dirname(output),{recursive:true});
  const temp=output+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(register)+'\n');renameSync(temp,output);
  console.log(JSON.stringify({path:output,sourceTimestamp:register.sourceTimestamp,chains:Object.fromEntries(Object.entries(register.chains).map(([id,value])=>[id,value.rows.length]))}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
