import {AccountService} from '../connection/AccountService.js?v=0.5.34';
import {ConnectionService} from '../connection/ConnectionService.js?v=0.5.34';
export const SHOPLIST_URL='https://stefan-van-dijk.github.io/shop/';
export class ShopListService {
 constructor(store,connection=new ConnectionService(store)){
  this.store=store;
  this.connection=connection;
  this.accounts=new AccountService(store,connection);
 }
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
  let account;
  try{account=await this.accounts.require();}catch{return false;}
  const saved=await this.store.get('meta','apps.shoplist.connected.'+account.personId);
  if(saved)return saved.value===true;
  const {devices}=await this.connection.request('shop-pair-list',{},await this.connection.device());
  return devices.some(device=>device.status==='active');
 }
 async setConnected(value){
  const account=await this.accounts.require();
  await this.store.put('meta',{key:'apps.shoplist.connected.'+account.personId,value});
 }
 index(){return this.request('index');}
 archive(id,archived=true){return this.request('archive',{id,archived});}
 leave(id){return this.request('leave',{id});}
 read(id){return this.request('read',{id});}
 write(payload,revision=0,operation=crypto.randomUUID(),create=false){return this.request(create?'create':'put',{id:payload.list.id,payload,revision,operation});}
 share(id,personId,role,categories=null){return this.request('share',{id,personId,role,categories});}
}
