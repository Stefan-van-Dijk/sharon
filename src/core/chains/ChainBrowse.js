import {CHAIN_ENDPOINT} from './ChainSyncService.js?v=0.4.07';
export class ChainBrowse {
 constructor({fetcher=(...args)=>fetch(...args),clock=()=>Date.now()}={}){this.fetcher=fetcher;this.clock=clock;this.cache=new Map();this.pending=new Map();}
 async request(input,signal){
  const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,15000);
  try{
  const response=await this.fetcher(CHAIN_ENDPOINT,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:1,...input}),signal:controller.signal});
  if(!response.ok)throw Error(response.status===503?'De landelijke winkelgegevens zijn nog niet beschikbaar.':'Winkelgegevens ophalen is niet gelukt.');
  const data=await response.json();if(data.schema!==1||!/^v1-[a-f0-9]{24}$/.test(data.version||''))throw Error('Ongeldige winkelgegevens.');return data;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async cached(key,input,signal){
  const old=this.cache.get(key);if(old&&this.clock()-old.at<300000)return old.data;
  const data=await this.request(input,signal);if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  this.cache.delete(key);this.cache.set(key,{at:this.clock(),data});while(this.cache.size>16)this.cache.delete(this.cache.keys().next().value);return data;
 }
 async catalog(signal){const data=await this.cached('catalog',{action:'catalog'},signal);
  if(!Array.isArray(data.chains)||data.chains.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'))throw Error('Ongeldige ketencatalogus.');return data.chains;
 }
 async area(bounds,chainId='',signal){
  const data=await this.cached('map:'+JSON.stringify([bounds,chainId]),{action:'map',bounds,chainId},signal);
  if(!Array.isArray(data.points)||data.points.length>2000)throw Error('Ongeldige kaartpunten.');
  const points=data.points.map(row=>{
   if(!Array.isArray(row)||row.length!==6||!/^[-_A-Za-z0-9]{12}$/.test(row[0])||typeof row[1]!=='string'||!Number.isInteger(row[2])||!Number.isInteger(row[3])||Math.abs(row[2])>180000000||Math.abs(row[3])>90000000||typeof row[4]!=='string'||! /^(node|way|relation)\/[1-9][0-9]*$/.test(row[5]))throw Error('Ongeldig kaartpunt.');
   return {id:row[0],chainId:row[1],coordinates:{lng:row[2]/1e6,lat:row[3]/1e6},name:row[4],sourceRef:row[5],status:'active',remote:true};
  });return {points,truncated:data.truncated===true};
 }
 async detail(branch,signal){
  if(!signal){if(this.pending.has(branch.id))return this.pending.get(branch.id);const request=this.detail(branch,new AbortController().signal).finally(()=>this.pending.delete(branch.id));this.pending.set(branch.id,request);return request;}
  const data=await this.cached('detail:'+branch.id,{action:'detail',id:branch.id},signal),d=data.detail;
  if(!d||d.id!==branch.id||d.chainId!==branch.chainId||d.sourceRef!==branch.sourceRef||typeof d.address!=='string'||typeof d.openingHours!=='string')throw Error('Ongeldige vestigingsdetails.');
  let website='';try{const url=new URL(d.website);if(url.protocol==='https:'&&!url.username&&!url.password)website=url.href;}catch{}
  return {...branch,address:d.address,openingHours:d.openingHours,website,remote:false};
 }
}
