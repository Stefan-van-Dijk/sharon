import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisRange,inAnalysisRange,analysisFetchRadius} from '../src/ui/AnalysisRange.js';
import {chainAreaBounds} from '../src/core/chains/ChainBrowse.js';
test('analysis radius defaults, custom limits and unlimited discovery keep source requests bounded',()=>{
 const old=globalThis.localStorage;let value=null;globalThis.localStorage={getItem:()=>value};
 try{
  assert.equal(analysisRange().meters,10000);
  value=JSON.stringify({meters:500,unlimited:false});
  assert.equal(inAnalysisRange({lat:52.001,lng:5},{lat:52,lng:5}),true);
  assert.equal(inAnalysisRange({lat:53,lng:5},{lat:52,lng:5}),false);
  assert.equal(analysisFetchRadius(),500);
  const small=chainAreaBounds({lat:52,lng:5},500),large=chainAreaBounds({lat:52,lng:5});assert.ok(small[0]>large[0]);
  value=JSON.stringify({meters:100000,unlimited:false});assert.equal(analysisFetchRadius(),10000);
  value=JSON.stringify({meters:500,unlimited:true});assert.equal(inAnalysisRange({lat:-30,lng:130},{lat:52,lng:5}),true);assert.equal(analysisFetchRadius(),10000);
  value=JSON.stringify({meters:-1});assert.equal(analysisRange().meters,10000);
 }finally{globalThis.localStorage=old;}
});
