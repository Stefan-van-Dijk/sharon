import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {buildAiTestPreview} from '../scripts/ai-test-preview.mjs';

test('AI preview seeds only empty test profiles and fixes GPS without shipping a production shortcut',async()=>{
 const output=buildAiTestPreview();
 const seed=readFileSync(output+'/ai-test-start.js','utf8');
 const code=seed.replace(/^import .*;\n/m,'').replace(/await import\([^\n]+\);/,'');
 const rows=new Map();
 class ObjectStore{async open(){return this;}async get(_table,key){return rows.get(key);}async put(_table,row){rows.set(row.key,row);}}
 const navigator={},document={createElement(){return {style:{}};},body:{append(){}}};
 const context=vm.createContext({ObjectStore,navigator,document,location:{hostname:'127.0.0.1'},queueMicrotask,Date});
 await vm.runInContext('(async()=>{'+code+'})()',context);
 assert.equal(rows.get('app').value.profile.name,'AI-testprofiel');
 assert.equal(rows.get('app').value.onboarding.storySeen,true);
 const position=await new Promise(resolve=>navigator.geolocation.getCurrentPosition(resolve));
 assert.equal(position.coords.latitude,51.22111);
 assert.equal(position.coords.longitude,4.39971);
 rows.set('app',{key:'app',value:{profile:{name:'Existing test user'}}});
 await vm.runInContext('(async()=>{'+code+'})()',context);
 assert.equal(rows.get('app').value.profile.name,'Existing test user');
 assert.match(readFileSync(output+'/src/ui/Boot.js','utf8'),/runReturningIntro\(\) \{\}/);
 assert.match(readFileSync('src/ui/Boot.js','utf8'),/await waitUntil\(startedAt, RETURNING_SHARE_MS\)/);
 assert.equal(existsSync('_site/ai-test-start.js'),false);
 assert.match(readFileSync('index.html','utf8'),/src="\.\/src\/main.js/);
 const remote=vm.createContext({ObjectStore,navigator:{},document,location:{hostname:'sharon.life'}});
 await assert.rejects(vm.runInContext('(async()=>{'+code+'})()',remote),/localhost/);
 assert.throws(()=>buildAiTestPreview(process.cwd(),{lat:100,lng:0}),/coördinaten/);
});
