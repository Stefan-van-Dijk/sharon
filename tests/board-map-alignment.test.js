import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardMapAlignment} from '../src/ui/BoardMapAlignment.js';
test('a selected shop is positioned in the free map area and pending alignment is cancelled on close',()=>{
 const previous=[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame];
 let pending=null,last,projected;
 globalThis.requestAnimationFrame=fn=>{pending=fn;return 1;};
 globalThis.cancelAnimationFrame=()=>{pending=null;};
 try{
  const map={getContainer:()=>({getBoundingClientRect:()=>({left:0,top:0,width:400,height:800})}),
   project:coords=>{projected=coords;return {x:200,y:400};},unproject:coords=>coords,easeTo:value=>{last=value;}};
  const alignment=createBoardMapAlignment(map,[5,52]);
  alignment.onLayout(null,{left:0,right:400,top:300,bottom:800});pending();
  assert.deepEqual(projected,[5,52]);assert.ok(last.center[1]>600,'move the selected point above the covering board');
  assert.equal(last.essential,true);
  alignment.onLayout(null,null);alignment.destroy();assert.equal(pending,null);
 }finally{[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame]=previous;}
});
