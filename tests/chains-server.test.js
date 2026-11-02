import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('chain endpoint returns requested full/delta/unchanged bundles and rejects GPS or invalid identifiers',()=>{
 execFileSync('php',['-l','server/chains.php']);
 const result=JSON.parse(execFileSync('php',['tests/helpers/chains-server.php'],{encoding:'utf8'}));
 assert.equal(result.ok,true);assert.ok(result.checks>=12);
});
