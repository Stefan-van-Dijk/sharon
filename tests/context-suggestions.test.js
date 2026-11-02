import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestConnections} from '../src/core/skeleton/ContextSuggestions.js';
const data={objects:[
{id:'Action000001',module:'actions',title:'Schutting repareren',status:'active'},
{id:'Person000001',module:'persons',title:'Jan',status:'active'},
{id:'Place0000001',module:'locations',title:'Bij Jan thuis',status:'active'},
{id:'Ride00000001',module:'rides',title:'Rit met Jan',status:'active'},
{id:'Person000002',module:'persons',title:'Piet',status:'active'}
],relations:[{id:'Rel000000001',from:'Ride00000001',to:'Person000001',type:'related-to'}]};
test('search existing objects without category dropdown',()=>{
const results=suggestConnections(data,'Action000001',{search:'jan'});
assert.equal(results.length,3);
assert.ok(results.every(r=>r.object.title.toLowerCase().includes('jan')));
});
test('explicitly chosen place is first',()=>{
const results=suggestConnections(data,'Action000001',{caseId:'at-place',focusId:'Place0000001'});
assert.equal(results[0].object.id,'Place0000001');
assert.equal(results[0].predicate,'at-location');
});
test('linked participant of active ride ranks before unrelated people',()=>{
const results=suggestConnections(data,'Action000001',{caseId:'on-ride',focusId:'Ride00000001'});
assert.ok(results.findIndex(r=>r.object.id==='Person000001') < results.findIndex(r=>r.object.id==='Person000002'));
});
test('does not mutate graph or create relations',()=>{
const before=JSON.stringify(data);
suggestConnections(data,'Action000001',{caseId:'on-ride'});
assert.equal(JSON.stringify(data),before);
});
