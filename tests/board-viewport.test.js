import test from 'node:test';
import assert from 'node:assert/strict';
import {inBoardViewport} from '../src/ui/BoardViewport.js';
test('source viewport selects the visible area and supports wrapped map longitudes',()=>{
 const map=(w,e,s=50,n=54)=>({getBounds:()=>({getWest:()=>w,getEast:()=>e,getSouth:()=>s,getNorth:()=>n})});
 assert.equal(inBoardViewport(map(4,6),{lat:52,lng:5}),true);
 assert.equal(inBoardViewport(map(4,6),{lat:52,lng:7}),false);
 assert.equal(inBoardViewport(map(4,6),{lat:55,lng:5}),false);
 assert.equal(inBoardViewport(map(170,-170),{lat:52,lng:-175}),true);
 assert.equal(inBoardViewport(map(170,190),{lat:52,lng:-175}),true);
 assert.equal(inBoardViewport(map(170,-170),{lat:52,lng:0}),false);
 assert.equal(inBoardViewport({}, {lat:52,lng:5}),true);
});

test('a board session freezes map bounds and pauses sources until explicitly released',async()=>{
 const {lockBoardViewport,boardViewportLocked,onBoardViewportLock}=await import('../src/ui/BoardViewport.js');
 let west=4,east=6,notices=0;
 const bounds={getWest:()=>west,getEast:()=>east,getSouth:()=>50,getNorth:()=>54},map={getBounds:()=>bounds};
 const stop=onBoardViewportLock(map,()=>notices++),unlock=lockBoardViewport(map);
 assert.equal(notices,1);assert.equal(boardViewportLocked(map),true);
 west=10;east=12;
 assert.equal(inBoardViewport(map,{lat:52,lng:5}),true);assert.equal(inBoardViewport(map,{lat:52,lng:11}),false);
 unlock();assert.equal(boardViewportLocked(map),false);assert.equal(inBoardViewport(map,{lat:52,lng:11}),true);
 stop();lockBoardViewport(map)();assert.equal(notices,1);
});
