import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
test('shared feedback server: authentication, retracting, retries, conflicts, policies and source isolation',()=>{
  execFileSync('php',['-l','server/connections.php']);
  const result=JSON.parse(execFileSync('php',['tests/helpers/information-server.php'],{encoding:'utf8'}));
  assert.equal(result.ok,true);assert.ok(result.checks>=25);
});
