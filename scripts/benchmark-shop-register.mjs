// Replays an existing browse artifact. It does not download or publish data.
import {readFileSync,readdirSync,statSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildBrowse} from './build-chain-browse.mjs';
import {writeShopTiles} from './shop-register.mjs';
const directory=process.argv[2];if(!directory)throw Error('Geef de uitgepakte legacy artifactmap mee.');
const previous=JSON.parse(readFileSync(join(directory,'browse-v1.json'))),register=JSON.parse(readFileSync(join(directory,'register-v1.json')));
const catalog=new Map(previous.chains.map(c=>[c.id,c]));let details={};
for(const [prefix,hash] of Object.entries(previous.detailFiles))Object.assign(details,JSON.parse(readFileSync(join(directory,'browse-details',prefix+'-'+hash+'.json'))));
const features=previous.points.map(([id,chain,lng,lat,name,ref])=>({type:'Feature',geometry:{type:'Point',coordinates:[lng/1e6,lat/1e6]},properties:{'@type':ref.split('/')[0],'@id':Number(ref.split('/')[1]),shop:details[id].kind,name,brand:catalog.get(chain).name,...(/^Q\d+$/.test(chain)?{'brand:wikidata':chain}:{}),website:details[id].website}}));
const start=performance.now(),result=buildBrowse({type:'FeatureCollection',features},register,previous),dir=mkdtempSync(join(tmpdir(),'shop-benchmark-'));
try{
 const manifest=writeShopTiles(result,dir),ids=new Map(Object.values(result.registry.branches).map(b=>[b.sourceRef,b.id]));
 const preserved=previous.points.filter(r=>ids.get(r[5])===r[0]).length;
 const tileFiles=Object.values(manifest.tiles),sizes=tileFiles.map(f=>statSync(join(dir,f)).size).sort((a,b)=>a-b);
 console.log(JSON.stringify({legacyBranches:previous.points.length,preserved,organizations:Object.keys(result.registry.organizations).length,elapsedMs:Math.round(performance.now()-start),tiles:tileFiles.length,tileMedianBytes:sizes[Math.floor(sizes.length/2)],tileMaxBytes:sizes.at(-1),immutableBytes:readdirSync(dir).reduce((n,f)=>n+statSync(join(dir,f)).size,0),ledgerBytes:Buffer.byteLength(JSON.stringify(result.registry)),legacyManifestBytes:statSync(join(directory,'browse-v1.json')).size,manifestBytes:statSync(join(dir,'manifest.json')).size},null,2));
 if(preserved!==previous.points.length)throw Error('Identiteitsverlies');
}finally{rmSync(dir,{recursive:true,force:true});}
