import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('world shop service bounds queries, includes independent stores, separates details and caches shared responses',()=>{
 const result=JSON.parse(execFileSync('php',['tests/helpers/world-shops.php'],{encoding:'utf8'}));assert.ok(result.checks>=15);
});
