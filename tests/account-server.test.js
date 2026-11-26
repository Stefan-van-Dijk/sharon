import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('account proofs and organization roles are bound to the original network identity', () => {
  const result = JSON.parse(execFileSync('php',['tests/helpers/account-server.php'],{encoding:'utf8'}));
  assert.ok(result.checks >= 30);
});
