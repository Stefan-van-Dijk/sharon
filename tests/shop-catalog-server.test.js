import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
test('Catalog binds identity, validates recipe references, rejects stale revisions and admits paired devices',()=>assert.equal(JSON.parse(execFileSync('php',['tests/helpers/shop-catalog-server.php'],{encoding:'utf8'})).ok,true));
