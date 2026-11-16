import {ConnectionService} from '../connection/ConnectionService.js?v=0.4.89';
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
 index(){return this.request('index');}
 archive(id,archived=true){return this.request('archive',{id,archived});}
 leave(id){return this.request('leave',{id});}
 read(id){return this.request('read',{id});}
 write(payload,revision=0,operation=crypto.randomUUID(),create=false){return this.request(create?'create':'put',{id:payload.list.id,payload,revision,operation});}
 share(id,personId,role,categories=null){return this.request('share',{id,personId,role,categories});}
}
