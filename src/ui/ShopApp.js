import {openShopCatalog} from './ShopCatalog.js?v=0.5.16';
import {SHOPLIST_URL} from '../core/shoplist/ShopListService.js?v=0.5.16';
export function shopAppUrl(id,account,mode,{categoryId,collectionId}={}){
 const url=new URL(SHOPLIST_URL);url.searchParams.set('v','20261118-category-board');if(id)url.searchParams.set('shoplist',id);url.searchParams.set('from','sharon');if(account)url.searchParams.set('account',account);if(mode==='collect'||mode==='check'||mode==='catalog')url.searchParams.set('view',mode);else if(!id)url.searchParams.set('view','collect');
 if(mode==='catalog'&&categoryId)url.searchParams.set('category',categoryId);
 if(mode==='catalog'&&collectionId)url.searchParams.set('collection',collectionId);
 return url.href;
}
// A session exposes only Shop operations. Sharon credentials never leave the host.
export function createShopSession(api,selectedId){
 const allowed=new Set(selectedId?[selectedId]:[]);let owner;
 return async(action,input={})=>{
  const device=await api.connection.device();
  if(!device.registered||!device.personId||device.self?.line==null)throw Error('Verbind eerst je identiteit in Sharon.');
  if(owner&&owner!==device.personId)throw Error('De Sharon-identiteit is gewijzigd. Open Shop opnieuw.');
  owner=device.personId;
  if(action==='session'){
   if(selectedId)await api.read(selectedId);
   return {self:{personId:owner,name:device.self.name||'Sharon'}};
  }
  if(action==='index'){const result=await api.index();return {...result,lists:result.lists.filter(row=>allowed.has(row.id))};}
  if(action==='catalog')return api.catalog();
  if(action==='library'){if(['create','share','contacts','category-lists','category-archive','collection-archive'].includes(input.command))throw Error('Deze catalogusactie beheer je in Sharon.');return api.library(input.command,input.payload);}
  if(action==='writeCatalog')return api.writeCatalog(input.payload,input.revision,input.operation);
  if(action==='write'&&input.create){
   let result;
   try{result=await api.write(input.payload,input.revision,input.operation,true);}
   catch(error){
    if(error.code!=='list_exists')throw error;
    // Recover a creation whose acknowledgement was lost, without adopting different content.
    result=await api.read(input.payload?.list?.id);
    if(result.role!=='owner'||JSON.stringify(result.list.payload)!==JSON.stringify(input.payload))throw error;
   }
   allowed.add(result.list.payload.list.id);return result;
  }
  if(!allowed.has(input.id))throw Error('Deze lijst is niet geopend in deze Shop-sessie.');
  if(action==='read')return api.read(input.id);
  if(action==='write'&&input.payload?.list?.id===input.id)return api.write(input.payload,input.revision,input.operation,false);
  throw Error('Deze actie wordt in Sharon beheerd.');
 };
}
export function mountShopApp(body,id,{api,mode,categoryId,collectionId,onReturn,registerCleanup=()=>{}}={}){
 const frame=body.ownerDocument.createElement('iframe'),win=body.ownerDocument.defaultView;
 const origin=new URL(SHOPLIST_URL).origin,request=api&&createShopSession(api,id);let disposed=false,closeCatalog=()=>{};
 const receive=async event=>{
  if(disposed||!body.contains(frame)||event.source!==frame.contentWindow||event.origin!==origin)return;
  if(event.data?.type==='shop:return-ready'&&onReturn){frame.dataset.returnReady='true';return;}
  if(event.data?.type==='shop:return'&&onReturn){onReturn();return;}
  if(event.data?.type==='shop:catalog-share'&&api){
   const {categoryId,collectionId}=event.data;if([categoryId,collectionId].some(id=>id!=null&&(typeof id!=='string'||id.length>160)))return;
   closeCatalog();closeCatalog=openShopCatalog({api,categoryId,collectionId});return;
  }
  if(event.data?.type!=='shop:request'||typeof event.data.requestId!=='string')return;
  const {requestId,action,input}=event.data;let reply;
  try{if(!request)throw Error('De Shop-sessie is niet beschikbaar.');reply={result:await request(action,input)};}
  catch(error){reply={error:{message:error.message,code:error.code||'session_error'}};}
  if(!disposed&&body.contains(frame))frame.contentWindow.postMessage({type:'shop:response',requestId,...reply},origin);
 };
 const setSource=account=>{if(!disposed)frame.src=shopAppUrl(id,account,mode,{categoryId,collectionId});};
 frame.className='sh-shop-app';frame.title='ShopList';if(api){api.connection.device().then(device=>setSource(device.personId)).catch(()=>setSource());}else setSource();
 frame.allow='camera; microphone';win.addEventListener('message',receive);
 registerCleanup(()=>{disposed=true;closeCatalog();win.removeEventListener('message',receive);});
 body.replaceChildren(frame);return frame;
}
