import test from 'node:test';import assert from 'node:assert/strict';
import {createShopPointMotion} from '../src/ui/ShopPointMotion.js';
test('shop points grow in and remain until faded out without rebuilding source every frame',()=>{
 let now=0,queued,sourceWrites=0,data;const states=[];
 const map={getSource:()=>({setData:d=>{sourceWrites++;data=d;}}),setFeatureState:(_id,s)=>states.push(s.shopVisibility)};
 const motion=createShopPointMotion(map,'shops',{reduced:false,clock:()=>now,frame:fn=>(queued=fn,1),cancel:()=>{queued=null;}});
 const feature={type:'Feature',id:'shop1',properties:{read:1},geometry:{type:'Point',coordinates:[5,52]}};
 motion.update({features:[feature]});assert.equal(states.at(-1),0);const writes=sourceWrites;
 now=110;queued();assert.ok(states.at(-1)>0&&states.at(-1)<1);assert.equal(sourceWrites,writes);
 now=220;queued();assert.equal(states.at(-1),1);
 motion.update({features:[]});assert.equal(data.features.length,1);
 now=330;queued();assert.ok(states.at(-1)<1&&states.at(-1)>0);assert.equal(data.features.length,1);
 now=440;queued();assert.equal(data.features.length,0);assert.equal(states.at(-1),0);
 motion.destroy();
});
test('reduced motion applies visibility immediately and teardown cancels animation',()=>{
 let data,cancelled=false;const map={getSource:()=>({setData:d=>data=d}),setFeatureState(){}};
 const reduced=createShopPointMotion(map,'s',{reduced:true});reduced.update({features:[]});assert.equal(data.features.length,0);reduced.destroy();
 const animated=createShopPointMotion(map,'s',{reduced:false,clock:()=>0,frame:()=>1,cancel:()=>cancelled=true});animated.update({features:[]});animated.destroy();assert.equal(cancelled,true);
});
test('motion keeps the final marker size and read opacity while scaling the entrance',async()=>{
 const {shopOpacity,shopRadius}=await import('../src/ui/ShopPointMotion.js');
 const evaluate=(e,value)=>{if(typeof e==='number')return e;if(e[0]==='feature-state')return value;if(e[0]==='coalesce')return evaluate(e[1],value)??e[2];if(e[0]==='*')return e.slice(1).reduce((a,b)=>a*evaluate(b,value),1);if(e[0]==='+')return e.slice(1).reduce((a,b)=>a+evaluate(b,value),0);throw Error('Unexpected expression');};
 assert.equal(evaluate(shopRadius(5),1),5);assert.equal(evaluate(shopRadius(5),0),3.25);
 assert.equal(evaluate(shopOpacity(.3),1),.3);assert.equal(evaluate(shopOpacity(.3),0),0);
});
