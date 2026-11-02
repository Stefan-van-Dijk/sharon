import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('Log JSON connection: ownership, recipient binding, expiry, authorization, idempotency, depth and first 100',()=>{
  execFileSync('php',['-l','server/connections.php']);
  const result=JSON.parse(execFileSync('php',['tests/helpers/connection-server.php'],{encoding:'utf8'}));
  assert.equal(result.ok,true);
  assert.ok(result.checks>=130);
});
