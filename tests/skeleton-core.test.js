import test from 'node:test';
import assert from 'node:assert/strict';
import {demoDataset,validateSkeleton,relatedTo,removalAction,skeletonCapabilities,applySkeletonAction,setDemoEnabled,demoWorkspace,saveDemoDataset,resetDemoDataset} from '../src/core/skeleton/SkeletonCore.js';
const store=()=>{const m=new Map();return {get:async(table,k)=>m.get(table+':'+k),put:async(table,v)=>m.set(table+':'+(v.key||v.id),v),delete:async(table,k)=>m.delete(table+':'+k)};};
test('demo references are valid and isolated from live objects',()=>{
 const d=validateSkeleton(demoDataset());
 assert.equal(d.objects.length,8);
 assert.ok(d.objects.some(o=>o.module==='environment'));
 assert.equal(relatedTo(d,'DemoCard0001').length,2);
 assert.equal(removalAction(d,'DemoCard0001'),'archive');
 assert.equal(removalAction(d,'DemoObject01'),'delete');
 assert.equal(skeletonCapabilities(d,'DemoCard0001').publish,false);
});
test('archiving leaves relations intact and allows restore',()=>{
 const old=demoDataset();
 const next=applySkeletonAction(old,'DemoCard0001','archive');
 assert.equal(next.relations.length,old.relations.length);
 assert.equal(removalAction(next,'DemoCard0001'),'restore');
 assert.equal(removalAction(old,'DemoCard0001'),'archive');
 assert.equal(applySkeletonAction(next,'DemoCard0001','restore').objects.find(o=>o.id==='DemoCard0001').status,'active');
 assert.throws(()=>applySkeletonAction(old,'DemoCard0001','delete'));
});
test('delete only isolated objects; all references validated',()=>{
 const data=applySkeletonAction(demoDataset(),'DemoObject01','delete');
 assert.equal(data.objects.some(o=>o.id==='DemoObject01'),false);
 assert.throws(()=>validateSkeleton({...data,relations:[...data.relations,{id:'BrokenRel001',from:'DemoCard0001',to:'MissingObj01',type:'related'}]}));
});
test('demo toggle and edits never touch live objects',async()=>{
 const db=store();
 await db.put('objects',{id:'RealObject01',type:'card',name:'Real'});
 assert.equal((await demoWorkspace(db)).enabled,false);
 await setDemoEnabled(db,true);
 let demo=(await demoWorkspace(db)).data;
 demo.objects[0].title='Modified demo';
 await saveDemoDataset(db,demo);
 assert.equal((await demoWorkspace(db)).data.objects[0].title,'Modified demo');
 assert.equal((await db.get('objects','RealObject01')).name,'Real');
 await resetDemoDataset(db);
 assert.equal((await demoWorkspace(db)).data.objects[0].title,'Voorbeeldomgeving');
 await setDemoEnabled(db,false);
 assert.equal((await demoWorkspace(db)).data,null);
});
