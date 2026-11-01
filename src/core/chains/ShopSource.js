import {IdentifierService} from '../ids/IdentifierService.js?v=0.4.55';
const identities=new Map();
function identity(ref){
 if(identities.has(ref))return identities.get(ref);
 let id;try{id=localStorage.getItem('sharon.shop.identity.'+ref);}catch{}
 if(!IdentifierService.isValid(id)){id=IdentifierService.create();try{localStorage.setItem('sharon.shop.identity.'+ref,id);}catch{}}
 identities.set(ref,id);return id;
}
// Direct, bounded OSM discovery also works before a Sharon PHP server is installed.
export async function fetchShopSource(input,{fetcher=fetch,signal}={}){
 let selector;
 if(input.action==='detail'){
  const match=/^(node|way|relation)\/([1-9][0-9]*)$/.exec(input.sourceRef||'');if(!match)throw Error('Ongeldige winkelbron');
  selector=match[1]+'('+match[2]+')';
 }else{
  const b=input.bounds;if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]||b[0]<-180||b[2]>180||b[1]<-90||b[3]>90||b[2]-b[0]>1||b[3]-b[1]>1)throw Error('Ongeldig winkelgebied');
  if(input.chainId&&!/^Q[1-9][0-9]*$/.test(input.chainId))throw Error('Deze merkfilter vereist het register');
  const brand=input.chainId?'["brand:wikidata"="'+input.chainId+'"]':'';
  selector='nwr["shop"]["shop"!~"^(no|vacant)$"]'+brand+'('+[b[1],b[0],b[3],b[2]].join(',')+')';
 }
 const query='[out:json][timeout:8];'+selector+';out body center 2001;';
 const response=await fetcher('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('Winkelbron tijdelijk niet bereikbaar');const source=await response.json();
 if(source.remark||!Array.isArray(source.elements))throw Error('Onvolledige winkelgegevens');
 const points=[],kinds={},details={};
 for(const e of source.elements.slice(0,2000)){
  const t=e.tags||{},lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;
  if(!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||!t.shop||['no','vacant'].includes(t.shop)||!Number.isFinite(lat)||!Number.isFinite(lng))continue;
  const ref=e.type+'/'+e.id,id=input.action==='detail'&&ref===input.sourceRef?input.id:identity(ref),chainId=/^Q[1-9][0-9]*$/.test(t['brand:wikidata']||'')?t['brand:wikidata']:'';
  const name=String(t.name||t.brand||t.shop);points.push([id,chainId,Math.round(lng*1e6),Math.round(lat*1e6),name,ref]);kinds[id]=t.shop;
  details[id]={id,chainId,sourceRef:ref,kind:t.shop,address:['addr:street','addr:housenumber','addr:postcode','addr:city'].map(k=>t[k]).filter(Boolean).join(' '),openingHours:t.opening_hours||'',website:t.website||t['contact:website']||''};
 }
 return {schema:1,version:'v1-'+'0'.repeat(24),coverage:'WORLD',points,kinds,truncated:source.elements.length>2000,...(input.action==='detail'?{detail:details[input.id]}:{})};
}
