import test from 'node:test';
import assert from 'node:assert/strict';
import {affectsIntro,introChanged} from '../scripts/check-intro-changes.mjs';
test('intro round includes shared dependencies but excludes unrelated shop and server changes',()=>{
 for(const path of ['src/ui/Boot.js','src/ui/Story.js','src/core/storage/ObjectStore.js','src/app.js','src/ui/LocationTypeSphere.js','index.html','tests/intro/intro.test.mjs'])assert.equal(affectsIntro(path),true,path);
 for(const path of ['server/chains.php','src/ui/ChainLayer.js','docs/AI-teststart.md'])assert.equal(affectsIntro(path),false,path);
 assert.equal(introChanged(undefined),true);
 assert.equal(introChanged('0'.repeat(40)),true);
});
