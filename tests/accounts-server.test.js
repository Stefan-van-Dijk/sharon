import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('Accounts bind verified email to one proven identity and enforce sessions, reset and app access',()=>{
 execFileSync('php',['-l','server/connections.php']);
 const result=JSON.parse(execFileSync('php',['tests/helpers/accounts-server.php'],{encoding:'utf8'}));
 assert.equal(result.ok,true);
 assert.ok(result.checks>=40);
});
