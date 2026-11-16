import test from 'node:test';
import assert from 'node:assert/strict';
import {SettingsService} from '../src/core/settings/SettingsService.js';
test('Failed settings save leaves committed choice intact and the next queued change still succeeds',async()=>{
 let fail=true;const events=[],writes=[];
 const settings=new SettingsService({put:async(_,record)=>{writes.push(record);if(fail){fail=false;throw Error('Disk full');}}},{emit:(_,value)=>events.push(value)});
 const rejected=settings.update({home:{modules:[]}}),good=settings.update({profile:{name:'Stefan'}});
 await assert.rejects(rejected,/Disk full/);await good;assert.equal(settings.get().home,undefined);assert.equal(settings.get().profile.name,'Stefan');assert.equal(events.length,1);
});
test('Concurrent settings patches merge in order after durable commits',async()=>{
 let release;const stored=[];const settings=new SettingsService({put:async(_,record)=>{if(!stored.length)await new Promise(r=>release=r);stored.push(record);}},{emit(){}});
 const first=settings.update({home:{modules:['locations']}});await Promise.resolve();const second=settings.update({profile:{name:'Stefan'}});
 assert.equal(settings.get().home,undefined);release();await Promise.all([first,second]);assert.deepEqual(stored[1].value.home.modules,['locations']);assert.equal(stored[1].value.profile.name,'Stefan');
});
