import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountShopApp,shopAppUrl} from '../src/ui/ShopApp.js';
test('Shop opens the exact list in its own application, without credentials in the URL',t=>{
 const dom=new JSDOM('<main>Old editor</main>');t.after(()=>dom.window.close());
 const body=dom.window.document.querySelector('main');const frame=mountShopApp(body,'a & b');
 assert.equal(body.children.length,1);assert.equal(frame.tagName,'IFRAME');
 const url=new URL(frame.src);assert.equal(url.pathname,'/shop/');assert.equal(url.searchParams.get('shoplist'),'a & b');assert.equal(url.searchParams.get('from'),'sharon');
 assert.deepEqual([...url.searchParams.keys()],['shoplist','from']);assert.equal(frame.allow,'camera; microphone');assert.equal(frame.title,'ShopList');
 assert.equal(shopAppUrl('other').includes('shoplist=other'),true);
});

import {createShopSession} from '../src/ui/ShopApp.js';
test('Embedded session uses Sharon identity, scopes lists and admits newly created lists',async()=>{
 let personId='me';const calls=[];
 const api={connection:{device:async()=>({registered:true,personId,self:{line:0,name:'Test'}})},read:async id=>{calls.push(id);return {list:{payload:{list:{id}}}};},index:async()=>({lists:[{id:'chosen'},{id:'other'},{id:'new'}]}),write:async payload=>({list:{payload}})};
 const request=createShopSession(api,'chosen');assert.deepEqual(await request('session'),{self:{personId:'me',name:'Test'}});assert.deepEqual(calls,['chosen']);
 assert.deepEqual((await request('index')).lists,[{id:'chosen'}]);await assert.rejects(request('read',{id:'other'}),/niet geopend/);
 await assert.rejects(request('leave',{id:'chosen'}),/in Sharon beheerd/);
 await request('write',{create:true,payload:{list:{id:'new'}},revision:0,operation:'once'});await request('read',{id:'new'});assert.equal(calls.at(-1),'new');
 personId='different';await assert.rejects(request('read',{id:'chosen'}),/identiteit is gewijzigd/);
});
test('An unregistered host cannot grant a Shop session',async()=>{
 const request=createShopSession({connection:{device:async()=>({registered:false})}},'chosen');await assert.rejects(request('session'),/Verbind eerst/);
});
test('Host ignores other frames/origins and removes the listener on close',async t=>{
 const dom=new JSDOM('<main/>',{url:'https://stefan-van-dijk.github.io/sharon/'});t.after(()=>dom.window.close());const win=dom.window,body=win.document.querySelector('main');let calls=0,dispose;
 const api={connection:{device:async()=>({personId:'me',registered:true,self:{line:1}})},read:async()=>{calls++;return {};}};
 const frame=mountShopApp(body,'chosen',{api,registerCleanup:fn=>dispose=fn});await new Promise(r=>setTimeout(r,0));
 const send=(origin,source)=>win.dispatchEvent(new win.MessageEvent('message',{origin,source,data:{type:'shop:request',requestId:'1',action:'session'}}));
 send('https://evil.example',frame.contentWindow);send('https://stefan-van-dijk.github.io',win);await new Promise(r=>setTimeout(r,0));assert.equal(calls,0);
 send('https://stefan-van-dijk.github.io',frame.contentWindow);await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);
 dispose();send('https://stefan-van-dijk.github.io',frame.contentWindow);await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);
});
test('Lost create acknowledgement recovers only matching owned content',async()=>{
 const payload={list:{id:'new',items:[]},products:[],categories:[]};let remote=payload;
 const api={connection:{device:async()=>({registered:true,personId:'me',self:{line:0}})},write:async()=>{throw Object.assign(Error('Exists'),{code:'list_exists'});},read:async()=>({role:'owner',list:{payload:remote}})};
 const request=createShopSession(api,null);await request('write',{create:true,payload,revision:0,operation:'retry'});await request('read',{id:'new'});
 remote={...payload,list:{id:'other',items:[]}};await assert.rejects(request('write',{create:true,payload,revision:0,operation:'retry'}),{code:'list_exists'});
});
