import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHAIN_CATALOG} from '../src/core/chains/ChainCatalog.js';
import {IdentifierService} from '../src/core/ids/IdentifierService.js';
import {environmentIdForPoint} from '../src/core/location/EnvironmentIdentifier.js';
import {decodeBranch} from '../src/core/chains/ChainModel.js';

export const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
export function chainQuery(brandId=null){
  const brands=brandId?[brandId]:CHAIN_CATALOG.flatMap(chain=>chain.brands);
  if(brands.some(id=>!/^Q[1-9][0-9]*$/.test(id)))throw Error('Ongeldig bronmerk.');
  // Exact value lookups can use the tag index; avoid a nationwide regex scan.
  return '[out:json][timeout:25];area["ISO3166-1"="NL"]["admin_level"="2"]->.nl;('+brands.map(id=>'nwr["brand:wikidata"="'+id+'"]["shop"](area.nl);').join('')+');out meta center;';
}
function validateSource(data,brandId){
  if(data?.remark||!Array.isArray(data?.elements)||!Number.isFinite(Date.parse(data?.osm3s?.timestamp_osm_base||'')))throw Error('Onvolledig OSM-antwoord'+(data?.remark?': '+data.remark:''));
  if(data.elements.some(item=>item.tags?.['brand:wikidata']!==brandId))throw Error('OSM-antwoord bevat een ander merk.');
  return data;
}
export async function fetchChainSource({fetcher=fetch,endpoints=OVERPASS_ENDPOINTS,timeoutMs=35000,rounds=2,
  wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=console.log}={}){
  if(!endpoints.length||rounds<1)throw Error('Geen OSM-bronnen ingesteld.');
  const brands=CHAIN_CATALOG.flatMap(chain=>chain.brands),parts=[];
  let preferred='';
  for(const [index,brandId] of brands.entries()){
    let part=null;const failures=[];
    const ordered=[...new Set([preferred,...endpoints].filter(Boolean))];
    for(let round=0;round<rounds&&!part;round++){
      if(round)await wait(2000*(round+1));
      for(const endpoint of ordered){
        const label=new URL(endpoint).host;
        log('OSM '+(index+1)+'/'+brands.length+' '+brandId+' · '+label+' · poging '+(round+1));
        const started=Date.now();
        try{
          const url=new URL(endpoint);url.searchParams.set('data',chainQuery(brandId));
          // These short GET queries also work on providers/proxies rejecting POST.
          const response=await fetcher(url.href,{headers:{'Accept':'application/json','User-Agent':'Sharon-chain-register/1.1 (https://github.com/Stefan-van-Dijk/sharon)'},signal:AbortSignal.timeout(timeoutMs)});
          if(!response.ok)throw Error('HTTP '+response.status);
          const candidate=validateSource(await response.json(),brandId);
          part=candidate;preferred=endpoint;
          log('OSM '+brandId+' · '+candidate.elements.length+' bronobjecten · '+label+' · '+Math.round((Date.now()-started)/1000)+' s');
          break;
        }catch(error){
          const reason=error.name==='TimeoutError'||error.name==='AbortError'?'time-out na '+Math.round(timeoutMs/1000)+' s':String(error.cause?.code||error.message||error.name);
          failures.push(label+': '+reason);log('OSM '+brandId+' · '+label+' mislukt: '+reason);
        }
      }
    }
    if(!part)throw Error('OSM-import afgebroken voor '+brandId+'. Bestaand register blijft behouden. '+failures.join(' | '));
    parts.push(part);
  }
  const elements=new Map();
  for(const part of parts)for(const item of part.elements){
    const key=item.type+'/'+item.id,old=elements.get(key);
    if(!old||item.version>old.version)elements.set(key,item);
    else if(item.version===old.version&&item.tags?.['brand:wikidata']!==old.tags?.['brand:wikidata'])throw Error('Tegenstrijdige OSM-versies voor '+key+'. Bestaand register blijft behouden.');
  }
  const oldest=Math.min(...parts.map(part=>Date.parse(part.osm3s.timestamp_osm_base)));
  return {osm3s:{timestamp_osm_base:new Date(oldest).toISOString()},elements:[...elements.values()]};
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
  const data=await fetchChainSource();
  const register=buildChainRegister(data,previous);
  mkdirSync(dirname(output),{recursive:true});
  const temp=output+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(register)+'\n');renameSync(temp,output);
  console.log(JSON.stringify({path:output,sourceTimestamp:register.sourceTimestamp,chains:Object.fromEntries(Object.entries(register.chains).map(([id,value])=>[id,value.rows.length]))}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
