import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentShapeLabels } from '../src/ui/EnvironmentData.js';
const project=p=>({x:p[0],y:p[1]});
const unproject=p=>[p.x,p.y];
test('polygon labels follow the longer direction and stay inside the shape',()=>{
  const poly={type:'Feature',geometry:{type:'Polygon',coordinates:[[[0,0],[160,0],[160,45],[0,45],[0,0]]]},properties:{title:'Winkel'}};
  const features=environmentShapeLabels([poly],project,unproject);
  assert.equal(features.length,1);
  const [a,b]=features[0].geometry.coordinates;
  assert.ok(Math.abs(a[1]-b[1])<0.01);
  assert.ok(a[1]>0&&a[1]<45);
});
test('hide text without enough interior space',()=>{
  const poly={type:'Feature',geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]]},properties:{title:'Een heel lange titel'}};
  assert.deepEqual(environmentShapeLabels([poly],project,unproject),[]);
});
