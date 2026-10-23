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
  return '[out:json][timeout:25];area["ISO3166-1"="NL"]["admin_level"="2"]->.nl;('+brands.map(id=>'nwr["brand:wikidata"="'+id+'"](50.7,3.2,53.7,7.3)(area.nl);').join('')+');out meta center;';
}
function validateSource(data,brandId){
  if(data?.remark||!Array.isArray(data?.elements)||!Number.isFinite(Date.parse(data?.osm3s?.timestamp_osm_base||'')))throw Error('Onvolledig OSM-antwoord'+(data?.remark?': '+data.remark:''));
  if(data.elements.some(item=>item.tags?.['brand:wikidata']!==brandId))throw Error('OSM-antwoord bevat een ander merk.');
  // Apply shop presence locally after the selective brand lookup. Intersecting
  // the worldwide shop index on the server is unnecessary for these brands.
  return {...data,elements:data.elements.filter(item=>typeof item.tags?.shop==='string'&&item.tags.shop.length>0)};
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
          if(!response.ok){
            const detail=typeof response.text==='function'?(await response.text()).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,180):'';
            throw Error('HTTP '+response.status+(detail?' · '+detail:''));
          }
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
export async function probeOverpass({fetcher=fetch,endpoints=OVERPASS_ENDPOINTS,log=console.log}={}){
  for(const endpoint of endpoints){
    const status=endpoint.replace(/interpreter$/,'status');
    for(const [kind,resource] of [['status',status],['minimale query',endpoint+'?'+new URLSearchParams({data:'[out:json][timeout:5];node(1);out;'})]]){
      try{
        const response=await fetcher(resource,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
        // Consume the response so the connection can be released, without
        // printing OSM element data or unrelated response headers.
        if(typeof response.text==='function')await response.text();
        log('OSM diagnose · '+new URL(endpoint).host+' · '+kind+' · HTTP '+response.status);
      }catch(error){log('OSM diagnose · '+new URL(endpoint).host+' · '+kind+' · '+(error.cause?.code||error.name)+': '+error.message);}
    }
  }
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
// Osmium exports exact source identities plus geometries from a complete
// Geofabrik country extract. A way can occur as both line and polygon.
export function sourceFromGeoJSON(data, timestamp){
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!Number.isFinite(Date.parse(timestamp)))throw Error('Ongeldige Nederlandse OSM-export.');
  const elements=new Map();
  const positions=geometry=>{
    if(geometry?.type==='GeometryCollection')return (geometry.geometries||[]).flatMap(positions);
    const flatten=value=>Array.isArray(value)&&value.length>=2&&value.every(Number.isFinite)?[value]:Array.isArray(value)?value.flatMap(flatten):[];
    return flatten(geometry?.coordinates);
  };
  for(const feature of data.features){
    const p=feature.properties||{};
    if(!p.shop||!CHAIN_CATALOG.some(chain=>chain.brands.includes(p['brand:wikidata'])))continue;
    const points=positions(feature.geometry);
    if(!points.length)throw Error('OSM-winkelgeometrie ontbreekt.');
    const lats=points.map(point=>point[1]),lngs=points.map(point=>point[0]);
    const point={lat:(Math.min(...lats)+Math.max(...lats))/2,lon:(Math.min(...lngs)+Math.max(...lngs))/2};
    const stamp=typeof p['@timestamp']==='number'?new Date(p['@timestamp']*1000).toISOString():p['@timestamp'];
    const item={type:p['@type'],id:p['@id'],version:p['@version'],timestamp:stamp,tags:Object.fromEntries(Object.entries(p).filter(([key])=>!key.startsWith('@'))),
      ...(p['@type']==='node'?point:{center:point})};
    const key=item.type+'/'+item.id,previous=elements.get(key);
    if(previous&&previous.version!==item.version)throw Error('Tegenstrijdige OSM-export.');
    elements.set(key,item);
  }
  return {osm3s:{timestamp_osm_base:timestamp},elements:[...elements.values()]};
}
async function main(){
  const output=resolve(process.argv[2]||'server/data/chains/register-v1.json');
  const previous=existsSync(output)?JSON.parse(readFileSync(output,'utf8')):null;
  let data;
  try{data=process.argv[3]?sourceFromGeoJSON(JSON.parse(readFileSync(process.argv[3],'utf8')),process.argv[4]):await fetchChainSource();}
  catch(error){await probeOverpass();throw error;}
  const register=buildChainRegister(data,previous);
  mkdirSync(dirname(output),{recursive:true});
  // Retain as much delta history as fits the deployed PHP download limit.
  while(Buffer.byteLength(JSON.stringify(register))>7900000){
    const largest=Object.values(register.chains).filter(chain=>chain.history.length).sort((a,b)=>JSON.stringify(b.history).length-JSON.stringify(a.history).length)[0];
    if(!largest)throw Error('Winkelregister overschrijdt de serverlimiet. Bestaand bestand blijft behouden.');
    largest.history.pop();
  }
  const temp=output+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(register)+'\n');renameSync(temp,output);
  console.log(JSON.stringify({path:output,sourceTimestamp:register.sourceTimestamp,chains:Object.fromEntries(Object.entries(register.chains).map(([id,value])=>[id,value.rows.length]))}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
