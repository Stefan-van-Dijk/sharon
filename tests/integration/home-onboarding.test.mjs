import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {appHarness} from '../helpers/app-harness.mjs';

for(const scenario of [
 {name:'nieuwe installatie begint met Omgeving en Locaties',saved:null,expected:['environment','locations']},
 {name:'bestaand profiel behoudt de bestaande volledige menukeuze',saved:{profile:{name:'Bestaand'}},expected:undefined},
 {name:'een bewust leeg startscherm blijft leeg',saved:{profile:{name:'Bestaand'},home:{modules:[]}},expected:[]},
 {name:'geforceerde kennismaking behoudt de eigen modulekeuze',saved:{profile:{name:'Bestaand'},home:{modules:['cards','notes']}},query:'?intro=1',expected:['cards','notes']}
])test(scenario.name,async t=>{
 const harness=await appHarness({root:resolve('.'),firstRun:true});t.after(()=>harness.close());
 if(scenario.saved)await harness.store.put('settings',{key:'app',value:scenario.saved});
 if(scenario.query)harness.window.history.replaceState(null,'',scenario.query);
 const {createApp}=await harness.load('./src/app.js');const app=await createApp();
 const home=app.services.settings.get().home?.modules;
 assert.equal(JSON.stringify(home),JSON.stringify(scenario.expected));
 const stored=(await harness.store.get('settings','app'))?.value.home?.modules;
 assert.equal(JSON.stringify(stored),JSON.stringify(scenario.expected));
});
