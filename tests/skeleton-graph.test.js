import test from 'node:test';
import assert from 'node:assert/strict';
import {demoDataset,validateSkeleton,removalAction} from '../src/core/skeleton/SkeletonCore.js';
import {RELATION_TYPES,graphConnections,graphNeighborhood,addGraphRelation,removeGraphRelation} from '../src/core/skeleton/GraphService.js';
test('typed triples expose inverse labels and linked named objects',()=>{
 const d=demoDataset();
 const outgoing=graphConnections(d,'DemoCard0001');
 assert.equal(outgoing.find(x=>x.target.title==='Voorbeeldwinkel').label,'is bruikbaar bij');
 const incoming=graphConnections(d,'DemoPlace001');
 assert.equal(incoming.find(x=>x.target.id==='DemoCard0001').label,'heeft kaart');
});
test('graph edits validate IDs, missing nodes, duplicates, predicates and deletion guards',()=>{
 const d=demoDataset();
 const next=addGraphRelation(d,{id:'NewGraph0001',from:'DemoTask0001',to:'DemoPlace001',type:'at-location'});
 assert.equal(validateSkeleton(next).relations.length,d.relations.length+1);
 assert.equal(removalAction(next,'DemoTask0001'),'archive');
 assert.throws(()=>addGraphRelation(next,{id:'NewGraph0002',from:'DemoTask0001',to:'DemoPlace001',type:'at-location'}));
 assert.throws(()=>addGraphRelation(d,{id:'NewGraph0002',from:'DemoTask0001',to:'NO_SUCH_NODE',type:'at-location'}));
 assert.throws(()=>addGraphRelation(d,{id:'NewGraph0002',from:'DemoTask0001',to:'DemoPlace001',type:'made-up'}));
 const undone=removeGraphRelation(next,'NewGraph0001');
 assert.equal(removalAction(undone,'DemoTask0001'),'delete');
 assert.equal(d.relations.length,3);
});
test('graph neighborhood is stable, connected, and depth limited',()=>{
 const d=demoDataset();
 const one=graphNeighborhood(d,'DemoPlace001',1);
 assert.ok(one.objects.some(x=>x.id==='DemoCard0001'));
 const two=graphNeighborhood(d,'DemoPlace001',2);
 assert.ok(two.objects.some(x=>x.id==='DemoPerson01'));
 assert.equal(graphNeighborhood(d,'none',1).objects.length,0);
 assert.ok(Object.keys(RELATION_TYPES).length>4);
});
