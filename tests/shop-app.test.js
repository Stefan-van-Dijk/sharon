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
