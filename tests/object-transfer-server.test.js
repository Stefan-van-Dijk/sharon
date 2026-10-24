import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
test('encrypted one-shot transfer requires publisher membership, guards read/delete and removes file only on ack',()=>{
 const r=JSON.parse(execFileSync('php',['tests/helpers/object-transfer-server.php'],{encoding:'utf8'}));assert.ok(r.checks>=10);
});
