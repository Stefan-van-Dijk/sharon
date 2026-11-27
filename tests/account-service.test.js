import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountService, ACCOUNT_SESSION_KEY} from '../src/core/connection/AccountService.js';
import {ConnectionService} from '../src/core/connection/ConnectionService.js';

test('Account login proves the existing identity, stores only the issued session and revokes it on logout', async () => {
 const device = {personId:'DeviceUser01',deviceToken:'d'.repeat(43)};
 const account = {id:'AccountId001',email:'user@example.test',personId:device.personId};
 const rows = new Map([['connection.device.log-json.v1',{value:device}]]);
 const store = {
  get:async (_,key)=>rows.get(key),
  getOrCreateMeta:async (key,create)=>rows.get(key)??{value:create()},
  put:async (_,row)=>rows.set(row.key,row),
  updateMeta:async(key,update)=>rows.set(key,{value:update(rows.get(key)?.value)})
 };
 let live = false;
 const requests = [];
 const connection = new ConnectionService(store, {fetcher:async (url,options)=>{
  const body = JSON.parse(options.body);
  requests.push({url,options,body});
  if (body.action === 'account-login') {
   assert.equal(body.personId,device.personId);
   assert.equal(body.deviceToken,device.deviceToken);
   live=true;
   return {ok:true,json:async()=>({account,sessionToken:'s'.repeat(43)})};
  }
  assert.equal(options.headers['X-Sharon-Account-Token'],'s'.repeat(43));
  if (body.action === 'account-logout') live=false;
  return {ok:true,json:async()=>({account:live?account:null})};
 }});
 const service = new AccountService(store,connection);
 assert.equal(await service.status(),null);
 assert.equal(requests.length,0);
 assert.deepEqual(await service.login({email:account.email,password:'A long password',name:'User'}),account);
 assert.deepEqual(await service.require(),account);
 assert(!JSON.stringify(rows.get(ACCOUNT_SESSION_KEY)).includes('password'));
 assert(requests.every(({url})=>!url.includes('s'.repeat(43))));
 await service.logout();
 assert.equal(rows.get(ACCOUNT_SESSION_KEY).value,null);
 await assert.rejects(service.require(),/Log in/);
});

test('Expired and mismatched account sessions do not grant access to local identity',async()=>{
 const rows = new Map([[ACCOUNT_SESSION_KEY,{value:{token:'s'.repeat(43)}}]]);
 const store={get:async(_,key)=>rows.get(key),updateMeta:async(key,update)=>rows.set(key,{value:update(rows.get(key)?.value)})};
 let account={personId:'AnotherId001'};
 const service=new AccountService(store,{
  request:async()=>({account}),device:async()=>({personId:'DeviceUser01'})
 });
 await assert.rejects(service.require(),/andere Sharon-identiteit/);
 account=null;
 assert.equal(await service.status(),null);
 assert.equal(rows.get(ACCOUNT_SESSION_KEY).value,null);
});

test('An expired status response cannot erase a session created by a later login',async()=>{
 let row={value:{token:'old'}};
 let finish;
 const store={get:async()=>row,updateMeta:async(_,update)=>{row={value:update(row?.value)};}};
 const service=new AccountService(store,{request:()=>new Promise(resolve=>{finish=resolve;})});
 const status=service.status();
 await new Promise(resolve=>setTimeout(resolve,0));
 row={value:{token:'new'}};
 finish({account:null});
 assert.equal(await status,null);
 assert.equal(row.value.token,'new');
});

test('Logout revokes its captured session and preserves a concurrent login',async()=>{
 let current={token:'old'};
 const store={get:async()=>({value:current}),updateMeta:async(_,update)=>{current=update(current);}};
 const service=new AccountService(store,{request:async(action,input,device,key,token)=>{
  assert.equal(action,'account-logout');
  assert.equal(token,'old');
  current={token:'new'};
 }});
 await service.logout();
 assert.equal(current.token,'new');
});
