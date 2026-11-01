import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildBrowse,buildInternationalBrowse} from '../scripts/build-chain-browse.mjs';
import {writeShopTiles,duplicateEvidence,legacyWorldId} from '../scripts/shop-register.mjs';
import {ChainBrowse,shopViewportBounds} from '../src/core/chains/ChainBrowse.js';
import {saveBranchLocation} from '../src/core/chains/ChainModel.js';
const register={sourceTimestamp:'2026-11-01T00:00:00Z',chains:{}};
const feature=(id,name='Bakkerij',extra={},coordinates=[5,52])=>({type:'Feature',properties:{'@type':'node','@id':id,'@version':1,'@timestamp':'2026-10-30',shop:'bakery',name,...extra},geometry:{type:'Point',coordinates}});
const source=(...features)=>({type:'FeatureCollection',features});
test('independent, branded and operator-distinct stores get separate persistent organizations and stable IDs',()=>{
 const data=source(feature(1),feature(2,'Keten',{brand:'Keten',operator:'Franchisenemer'}),feature(3,'Keten',{brand:'Keten'}));
 const first=buildBrowse(data,register),second=buildBrowse(data,register,first);
 assert.equal(first.points.length,3);assert.equal(Object.keys(first.registry.organizations).length,2);
 assert.deepEqual(second.points,first.points);assert.deepEqual(second.registry,first.registry);
 assert.equal(Object.values(first.details).find(d=>d.sourceRef==='node/2').relationship,'operator-distinct');
 assert.ok(Object.keys(first.registry.organizations).every(id=>/^[A-Za-z0-9_-]{12}$/.test(id)));
});
test('legacy IDs, disappearance/reappearance, Unicode and international address fields survive imports',()=>{
 const previous={points:[['legacy000001','',5000000,52000000,'Old','node/1']]};
 const initial=buildBrowse(source(feature(1,'Bäckerei 東京',{'addr:country':'de','addr:unit':'A','addr:city':'Köln'}),feature(2)),register,previous,{countryCode:'DE'});
 const d=initial.details.legacy000001;assert.equal(d.countryCode,'DE');assert.equal(d.addressParts['addr:unit'],'A');assert.equal(d.name,'Bäckerei 東京');
 const absent=buildBrowse(source(feature(2)),register,initial,{countryCode:'DE'});
 assert.equal(absent.registry.branches.legacy000001.status,'possibly-closed');
 const restored=buildBrowse(source(feature(1,'Nieuwe naam'),feature(2)),register,absent,{countryCode:'DE'});
 assert.equal(restored.details.legacy000001.organizationId,d.organizationId);
 assert.ok(d.aliases.includes(legacyWorldId('node/1')));
 const belgium=buildBrowse(source(feature(4,'Épicerie',{'addr:postcode':'1000'},[4.35,50.85])),register,null,{countryCode:'BE'});
 assert.equal(Object.values(belgium.details)[0].countryCode,'BE');
});
test('same source deduplicates; same building/name does not merge different shops',()=>{
 const data=source(feature(1),feature(1),feature(2));assert.equal(buildBrowse(data,register).points.length,2);
 const a={name:' café  Élan ',sourceRef:'node/1',countryCode:'NL',lat:52,lng:5,address:'Straat 1',website:'https://example.org',unit:'A'};
 assert.equal(duplicateEvidence(a,{...a,sourceRef:'way/2',name:'CAFÉ Élan'}),'review-name-address-website');
 assert.equal(duplicateEvidence(a,{...a,sourceRef:'way/2',unit:'B'}),null);
 assert.equal(duplicateEvidence(a,{...a,sourceRef:'way/2',website:''}),null);
 assert.equal(duplicateEvidence(a,{...a,sourceRef:'way/2',lng:6}),null);
});
test('immutable geographic tiles are served through the existing PHP map/detail and worldwide identity route',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sharon-tiles-'));
 try{
  const data=buildBrowse(source(feature(1,'Bäckerei'),feature(2,'Ver weg',{},[12,52])),register);
  writeShopTiles(data,dir);
  const result=JSON.parse(execFileSync('php',['tests/helpers/shop-tiles.php',dir],{encoding:'utf8'}));
  assert.equal(result.points.length,1);assert.equal(result.points[0].length,6);assert.equal(result.detail.id,result.points[0][0]);
  assert.equal(result.detail.countryCode,'NL');assert.equal(result.kinds[result.detail.id],'bakery');
  assert.equal(result.world.points[0][0],result.detail.id);assert.equal(result.legacy.detail.id,legacyWorldId('node/1'));
  assert.ok(result.rejected);assert.ok(result.tamperRejected);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('overlapping discovery only requests missing strips and bounds retained cache size',async()=>{
 const calls=[],browse=new ChainBrowse({fetcher:async(_,options)=>{const q=JSON.parse(options.body);calls.push(q.bounds);return {ok:true,json:async()=>({schema:1,version:'v1-'+'a'.repeat(24),coverage:'WORLD',points:[],truncated:false})};}});
 await browse.area([5,52,5.1,52.1]);await browse.area([5.05,52,5.15,52.1]);
 assert.deepEqual(calls,[[5,52,5.1,52.1],[5.1,52,5.15,52.1]]);
 for(let i=0;i<40;i++)await browse.area([i,40,i+.1,40.1]);assert.ok(browse.areas.length<=32);assert.ok(browse.cache.size<=16);
});
test('cached details remain usable on network failure; small analysis radii reduce fetch bounds',async()=>{
 let offline=false,now=0;
 const browse=new ChainBrowse({clock:()=>now,fetcher:async()=>{if(offline)throw Error('offline');return {ok:true,json:async()=>({schema:1,version:'v1-'+'a'.repeat(24),detail:{id:'branch000001',chainId:'',sourceRef:'node/1',address:'Straat',openingHours:'',website:''}})};}});
 const branch={id:'branch000001',chainId:'',sourceRef:'node/1'};
 await browse.detail(branch);offline=true;now=600000;assert.equal((await browse.detail(branch)).address,'Straat');
 const [w,s,e,n]=shopViewportBounds({lat:52,lng:5},null,500);assert.ok(e-w<.02);assert.ok(n-s<.01);
});
test('saving a canonical branch preserves an existing personal location and legacy association',async()=>{
 const old={id:'location0001',type:'location',data:{branchId:legacyWorldId('node/1'),sourceRef:'node/1',title:'Mijn winkel',coordinates:{lat:52,lng:5},radiusM:150}};
 let saved;const store={getAll:async()=>[old],put:async(_,v)=>saved=v};
 await saveBranchLocation(store,{id:'canonical001',chainId:'',sourceRef:'node/1',name:'Bakker',coordinates:{lat:52.1,lng:5.1}});
 assert.equal(saved.id,old.id);assert.equal(saved.data.branchId,old.data.branchId);assert.equal(saved.data.title,'Mijn winkel');assert.equal(saved.data.canonicalBranchId,'canonical001');assert.deepEqual(saved.data.coordinates,old.data.coordinates);
});

test('NL, BE and DE extracts share one importer, geographic manifest and identity ledger',()=>{
 const sources=[{countryCode:'NL',data:source(feature(1))},{countryCode:'BE',data:source(feature(2,'Épicerie',{},[4.35,50.85]))},{countryCode:'DE',data:source(feature(3,'Bäckerei',{},[6.95,50.94]))}];
 const first=buildInternationalBrowse(sources,register),second=buildInternationalBrowse(sources,register,first);
 assert.equal(first.coverage,'WORLD');assert.deepEqual(first.points,second.points);
 assert.deepEqual(new Set(Object.values(first.details).map(d=>d.countryCode)),new Set(['NL','BE','DE']));
});

test('an imported v2 manifest cannot reseed identities when its ledger is missing',()=>{
 const previous=buildBrowse(source(feature(1)),register);delete previous.registry;
 assert.throws(()=>buildBrowse(source(feature(1)),register,previous),/ledger ontbreekt/);
});
test('IndexedDB transaction coalesces simultaneous saves using old and canonical branch IDs',async()=>{
 const {IDBFactory}=await import('fake-indexeddb');const {ObjectStore}=await import('../src/core/storage/ObjectStore.js');
 globalThis.indexedDB=new IDBFactory();const store=await new ObjectStore().open();
 const oldId=legacyWorldId('node/1'),base={chainId:'',sourceRef:'node/1',name:'Winkel',coordinates:{lat:52,lng:5}};
 const saved=await saveBranchLocation(store,{...base,id:oldId});
 await Promise.all([saveBranchLocation(store,{...base,id:'canonical001'}),saveBranchLocation(store,{...base,id:oldId})]);
 const objects=await store.getAll('objects');assert.equal(objects.length,1);assert.equal(objects[0].id,saved.id);assert.equal(objects[0].data.branchId,oldId);
});
