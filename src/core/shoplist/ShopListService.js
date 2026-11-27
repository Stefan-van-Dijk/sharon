import {AccountService} from '../connection/AccountService.js?v=0.5.26';
import {ConnectionService} from '../connection/ConnectionService.js?v=0.5.26';
export const SHOPLIST_URL='https://stefan-van-dijk.github.io/shop/';
export class ShopListService {
 constructor(store){this.connection=new ConnectionService(store);this.accounts=new AccountService(store,this.connection);}
 async request(action,input={}){
  const device=await this.connection.device();
  await this.accounts.require();
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
 async isConnected(){
  const device=await this.connection.device();
  if(!await this.accounts.status())return false;
  const {devices}=await this.connection.request('shop-pair-list',{},device);
  return devices.some(device=>device.status==='active');
 }
 index(){return this.request('index');}
 archive(id,archived=true){return this.request('archive',{id,archived});}
 leave(id){return this.request('leave',{id});}
 read(id){return this.request('read',{id});}
 write(payload,revision=0,operation=crypto.randomUUID(),create=false){return this.request(create?'create':'put',{id:payload.list.id,payload,revision,operation});}
 share(id,personId,role,categories=null){return this.request('share',{id,personId,role,categories});}
}
