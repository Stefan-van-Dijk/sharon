import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisZoneGeoJSON} from '../src/ui/AnalysisZone.js';
import {distanceMeters} from '../src/core/location/GeographicBranchIndex.js';
test('visible analysis zone follows geodesic distance and closes its boundary at 200 km',()=>{
 const center={lat:52,lng:5},data=analysisZoneGeoJSON({center,meters:200000,unlimited:false});
 assert.equal(data.features.length,2);
 const ring=data.features[0].geometry.coordinates[0];assert.deepEqual(ring[0],ring.at(-1));
 for(const [lng,lat] of ring)assert.ok(Math.abs(distanceMeters(center,{lng,lat})-200000)<1);
 assert.equal(analysisZoneGeoJSON({center,meters:0,unlimited:false}).features.length,1);
 assert.equal(analysisZoneGeoJSON({center,meters:200000,unlimited:true}).features.length,1);
 assert.equal(analysisZoneGeoJSON({center:null}).features.length,0);
});

test('fit padding keeps the circle clear of bottom and side settings sheets',async()=>{
 const {analysisZonePadding}=await import('../src/ui/AnalysisZone.js');
 const view={left:10,top:20,width:800,height:600};
 assert.deepEqual(analysisZonePadding(view,{left:10,right:810,top:420,bottom:620,width:800,height:200}),{left:24,right:24,top:24,bottom:224});
 assert.deepEqual(analysisZonePadding(view,{left:10,right:260,top:20,bottom:620,width:250,height:600}),{left:274,right:24,top:24,bottom:24});
 assert.equal(analysisZonePadding(view,{left:900,right:1000,top:20,bottom:120,width:100,height:100}),40);
 assert.equal(analysisZonePadding(undefined,undefined),40);
});
