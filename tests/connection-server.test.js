import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('PHP connection: ownership, recipient binding, expiry, authorization, idempotency, depth and first 100',()=>{
  for(const file of ['Connection.php','api.php','setup.php'])execFileSync('php',['-l','server/connection/'+file]);
  const result=JSON.parse(execFileSync('php',['tests/helpers/connection-server.php'],{encoding:'utf8'}));
  assert.equal(result.ok,true);
  assert.ok(result.checks>=130);
});
