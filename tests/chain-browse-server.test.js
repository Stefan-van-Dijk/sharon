import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
test('public browse API bounds area queries, separates details and verifies immutable detail buckets',()=>{
 const result=JSON.parse(execFileSync('php',['tests/helpers/chain-browse-server.php'],{encoding:'utf8'}));assert.ok(result.checks>=8);
});
