import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisRange,inAnalysisRange,analysisFetchRadius} from '../src/ui/AnalysisRange.js';
test('visible viewport replaces the removed search radius and ignores old saved limits',()=>{
 const old=globalThis.localStorage;
 globalThis.localStorage={getItem:()=>JSON.stringify({meters:0,unlimited:false,visible:true,center:{lat:52,lng:5}})};
 try{assert.equal(analysisRange().unlimited,true);assert.equal(analysisRange().visible,false);assert.equal(inAnalysisRange({lat:53,lng:6},{lat:52,lng:5}),true);assert.equal(analysisFetchRadius(),10000);}finally{globalThis.localStorage=old;}
});
