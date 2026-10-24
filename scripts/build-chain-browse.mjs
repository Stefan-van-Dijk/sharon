import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHAIN_CATALOG} from '../src/core/chains/ChainCatalog.js';
import {IdentifierService} from '../src/core/ids/IdentifierService.js';
export function buildBrowse(data,register,previous=null){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!register?.sourceTimestamp)throw Error('Ongeldige landelijke bron.');
 const identities=new Map((previous?.points||[]).map(row=>[row[5],row[0]]));
 for(const c of Object.values(register.chains))for(const row of c.rows)if(!identities.has(row[1]))identities.set(row[1],row[0]);
 const labels=new Map();const normalize=value=>value.toLocaleLowerCase('nl').normalize('NFKC').trim();
 const canonical=qid=>CHAIN_CATALOG.find(c=>c.brands.includes(qid))?.id||qid;
 const add=(label,id)=>{const key=normalize(label);if(!labels.has(key))labels.set(key,new Set());labels.get(key).add(id);};
 for(const chain of CHAIN_CATALOG)add(chain.name,chain.id);
 for(const f of data.features){const p=f.properties||{};if((p.shop||p.amenity||p.tourism)&&typeof p.brand==='string'&&/^Q[1-9][0-9]*$/.test(p['brand:wikidata']||''))add(p.brand,canonical(p['brand:wikidata']));}
 const chains=new Map(),points=new Map(),details={};const used=new Set(identities.values());
 const flatten=value=>Array.isArray(value)&&value.length>=2&&value.every(Number.isFinite)?[value]:Array.isArray(value)?value.flatMap(flatten):[];
 for(const f of data.features){
  const p=f.properties||{},brand=String(p.brand||'').trim(),qid=/^Q[1-9][0-9]*$/.test(p['brand:wikidata']||'')?p['brand:wikidata']:null;
  if(!(p.shop||p.amenity||p.tourism)||(!brand&&!qid))continue;
  if(!['node','way','relation'].includes(p['@type'])||!Number.isSafeInteger(p['@id'])||p['@id']<1)throw Error('Bronidentiteit ontbreekt.');
  const positions=flatten(f.geometry?.coordinates);if(!positions.length)throw Error('Vestigingsgeometrie ontbreekt.');
  const lngs=positions.map(x=>x[0]),lats=positions.map(x=>x[1]);
  const lng=(Math.min(...lngs)+Math.max(...lngs))/2,lat=(Math.min(...lats)+Math.max(...lats))/2;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Ongeldige positie.');
  const byName=labels.get(normalize(brand));const inferred=!qid&&byName?.size===1?[...byName][0]:null;
  const known=CHAIN_CATALOG.find(c=>c.brands.includes(qid)||c.id===inferred);
  const chainId=known?.id||qid||inferred||'b-'+createHash('sha256').update(brand.toLocaleLowerCase('nl').normalize('NFKC')).digest('hex').slice(0,16);
  const chainName=known?.name||brand||String(p.name||qid),sourceRef=p['@type']+'/'+p['@id'];
  let id=identities.get(sourceRef);if(!id){do{id=IdentifierService.create();}while(used.has(id));used.add(id);identities.set(sourceRef,id);}
  const name=String(p.name||chainName).slice(0,300);
  const website=String(p.website||p['contact:website']||p['brand:website']||'');
  const address=[[p['addr:street'],p['addr:housenumber']].filter(Boolean).join(' '),[p['addr:postcode'],p['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ').slice(0,500);
  points.set(sourceRef,[id,chainId,Math.round(lng*1e6),Math.round(lat*1e6),name,sourceRef]);
  details[id]={id,chainId,sourceRef,name,address,openingHours:String(p.opening_hours||'').slice(0,300),website:/^https:\/\//i.test(website)?website.slice(0,2000):'',status:'active',kind:String(p.shop||p.amenity||p.tourism).slice(0,100)};
  if(!chains.has(chainId))chains.set(chainId,{id:chainId,name:chainName.slice(0,300),kind:details[id].kind,count:0});
 }
 if(!points.size)throw Error('Geen ketenvestigingen gevonden.');
 for(const row of points.values())chains.get(row[1]).count++;
 const rows=[...points.values()].sort((a,b)=>a[0].localeCompare(b[0]));
 return {schema:1,coverage:'NL',sourceTimestamp:register.sourceTimestamp,version:'v1-'+createHash('sha256').update(JSON.stringify([rows,details])).digest('hex').slice(0,24),chains:[...chains.values()].sort((a,b)=>a.name.localeCompare(b.name,'nl')),points:rows,details};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [input,registerPath,output]=process.argv.slice(2);const previous=existsSync(output)?JSON.parse(readFileSync(output,'utf8')):null;
 const result=buildBrowse(JSON.parse(readFileSync(input,'utf8')),JSON.parse(readFileSync(registerPath,'utf8')),previous);
 const {details,...manifest}=result;const directory=join(dirname(output),'browse-details');mkdirSync(directory,{recursive:true});
 manifest.detailFiles={};const buckets={};for(const [id,value] of Object.entries(details))(buckets[id[0]]??={})[id]=value;
 for(const [prefix,bucket] of Object.entries(buckets)){const raw=JSON.stringify(bucket)+'\n',hash=createHash('sha256').update(raw).digest('hex');if(Buffer.byteLength(raw)>2000000)throw Error('Detailbestand te groot.');manifest.detailFiles[prefix]=hash;writeFileSync(join(directory,prefix+'-'+hash+'.json'),raw);}
 const raw=JSON.stringify(manifest)+'\n';if(Buffer.byteLength(raw)>16000000)throw Error('Landelijk register te groot.');
 writeFileSync(output+'.tmp',raw);renameSync(output+'.tmp',output);console.log(JSON.stringify({chains:result.chains.length,branches:result.points.length,bytes:Buffer.byteLength(raw)}));
}
