import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('Shop pairing binds one device after confirmation, expires, restricts scope and revokes access',()=>{assert.equal(JSON.parse(execFileSync('php',['tests/helpers/shop-pair-server.php'],{encoding:'utf8'})).ok,true);});
