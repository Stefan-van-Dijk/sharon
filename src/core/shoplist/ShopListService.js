import {ConnectionService} from '../connection/ConnectionService.js?v=0.4.81';
export const SHOPLIST_URL='https://stefan-van-dijk.github.io/shop/';
export class ShopListService {
 constructor(store){this.connection=new ConnectionService(store);}
 async request(action,input={}){
  const device=await this.connection.device();
  if(!device.registered||device.self?.line==null)throw Error('Verbind eerst je identiteit in Sharon → Personen.');
  return this.connection.request('shoplist-'+action,input,device);
 }
 index(){return this.request('index');}
 read(id){return this.request('read',{id});}
 write(payload,revision=0,operation=crypto.randomUUID(),create=false){return this.request(create?'create':'put',{id:payload.list.id,payload,revision,operation});}
 share(id,personId,role){return this.request('share',{id,personId,role});}
}
