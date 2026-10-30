import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisZoneGeoJSON} from '../src/ui/AnalysisZone.js';
import {distanceMeters} from '../src/core/location/GeographicBranchIndex.js';
test('visible analysis zone follows geodesic distance and closes its boundary at 500 km',()=>{
 const center={lat:52,lng:5},data=analysisZoneGeoJSON({center,meters:500000,unlimited:false});
 assert.equal(data.features.length,2);
 const ring=data.features[0].geometry.coordinates[0];assert.deepEqual(ring[0],ring.at(-1));
 for(const [lng,lat] of ring)assert.ok(Math.abs(distanceMeters(center,{lng,lat})-500000)<1);
 assert.equal(analysisZoneGeoJSON({center,meters:0,unlimited:false}).features.length,1);
 assert.equal(analysisZoneGeoJSON({center,meters:500000,unlimited:true}).features.length,1);
 assert.equal(analysisZoneGeoJSON({center:null}).features.length,0);
});
