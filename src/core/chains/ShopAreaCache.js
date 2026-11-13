// Public shop snapshots only; independent of personal cards, people and locations.
// Failure/quota/private browsing must never prevent online discovery.
export class ShopAreaCache {
 constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;}
 async db(){
  if(!this.indexedDB)return null;
  if(!this.opening)this.opening=new Promise(resolve=>{
   let settled=false;const done=value=>{if(settled){value?.close();return;}settled=true;clearTimeout(timer);resolve(value);};
   const timer=setTimeout(()=>done(null),1500);
   try{const request=this.indexedDB.open('sharon-public-shop-areas',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('areas',{keyPath:'key'});
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();done(request.result);};
    request.onerror=()=>done(null);request.onblocked=()=>done(null);
   }catch{done(null);}
  });
  return this.opening;
 }
 async get(key){
  const db=await this.db();if(!db)return null;
  return new Promise(resolve=>{try{const tx=db.transaction('areas'),r=tx.objectStore('areas').get(key);r.onsuccess=()=>resolve(r.result?.entry||null);r.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);}catch{resolve(null);}});
 }
 async delete(key){
  const db=await this.db();if(!db)return;
  return new Promise(resolve=>{try{const tx=db.transaction('areas','readwrite');tx.objectStore('areas').delete(key);tx.oncomplete=()=>resolve();tx.onabort=()=>resolve();tx.onerror=()=>resolve();}catch{resolve();}});
 }
 async put(key,entry){
  if(!Array.isArray(entry.data?.points)||entry.data.points.length>2000)return;
  const db=await this.db();if(!db)return;
  return new Promise(resolve=>{try{
   const tx=db.transaction('areas','readwrite'),store=tx.objectStore('areas');
   store.put({key,entry});const read=store.getAll();
   read.onsuccess=()=>{
    const rows=read.result.sort((a,b)=>b.entry.at-a.entry.at);let bytes=0;
    rows.forEach((row,i)=>{bytes+=JSON.stringify(row).length*2;if(i>=128||bytes>4000000)store.delete(row.key);});
   };
   tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
  }catch{resolve();}});
 }
}
