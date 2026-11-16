import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('Category grants filter list contents on server, reject writes and support full-access restoration and revocation',()=>{
 assert.equal(JSON.parse(execFileSync('php',['tests/helpers/shop-category-sharing.php'],{encoding:'utf8'})).ok,true);
});
