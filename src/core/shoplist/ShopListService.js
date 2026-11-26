import {ConnectionService} from '../connection/ConnectionService.js?v=0.5.11';
export const SHOPLIST_URL='https://stefan-van-dijk.github.io/shop/';
export class ShopListService {
 constructor(store){this.connection=new ConnectionService(store);}
 async request(action,input={}){
  const device=await this.connection.device();
  if(!device.registered||device.self?.line==null)throw Error('Verbind eerst je identiteit in Sharon → Personen.');
  return this.connection.request('shoplist-'+action,input,device);
 }
 async catalog(){const device=await this.connection.device();return this.connection.request('shopcatalog-read',{},device);}
 async writeCatalog(payload,revision,operation=crypto.randomUUID()){const device=await this.connection.device();return this.connection.request('shopcatalog-put',{payload,revision,operation},device);}
 async library(command,input={}){
  const allowed=['product','product-edit','products','lookup','barcode-remove','contacts','index','create','share','item','category-lists','category-archive','collection-archive'];
  if(!allowed.includes(command))throw Error('Onbekende ShopList-actie.');
  const device=await this.connection.device();
  const {action,protocol,...payload}=input;
  return this.connection.request('shoplibrary-'+command,payload,device);
 }
 index(){return this.request('index');}
 archive(id,archived=true){return this.request('archive',{id,archived});}
 leave(id){return this.request('leave',{id});}
 read(id){return this.request('read',{id});}
 write(payload,revision=0,operation=crypto.randomUUID(),create=false){return this.request(create?'create':'put',{id:payload.list.id,payload,revision,operation});}
 share(id,personId,role,categories=null){return this.request('share',{id,personId,role,categories});}
}
