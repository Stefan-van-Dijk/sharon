import test from 'node:test';import assert from 'node:assert/strict';
import {shopContextMode,shopPreview} from '../src/core/shoplist/ShopContext.js';
const now=1000000,point={lat:52,lng:5,accuracy:10,at:now};
const place=(kind,id=kind)=>({id,type:'location',data:{kind,coordinates:{lat:52,lng:5},radiusM:100}});
test('Shop mode uses definite fresh saved locations and preserves choice when uncertain',()=>{
 assert.equal(shopContextMode([place('home')],point,'check',now),'collect');
 assert.equal(shopContextMode([place('shop')],point,'collect',now),'check');
 for(const fix of [null,{...point,accuracy:200},{...point,at:now-120000}])assert.equal(shopContextMode([place('home')],fix,'check',now),'check');
 assert.equal(shopContextMode([place('shop'),place('home')],point,'check',now),'check');
 assert.equal(shopContextMode([{...place('shop'),archivedAt:1}],point,'collect',now),'collect');
 assert.equal(shopContextMode([place('work')],point,'collect',now),'collect');
});
test('Preview preserves source, counts completed lines and shows at most four pending products',()=>{
 const payload={products:[{id:'p',name:'Melk'}],list:{items:[{productId:'p',quantity:2,done:true},...Array.from({length:6},()=>({productId:'p',quantity:1,done:false})),{productId:'p',quantity:0}]}};
 const original=structuredClone(payload),preview=shopPreview(payload,'check');
 assert.equal(preview.total,7);assert.equal(preview.done,1);assert.equal(preview.remaining,6);assert.equal(preview.rows.length,4);assert.equal(preview.rows[0].name,'Melk');assert.deepEqual(payload,original);
});
