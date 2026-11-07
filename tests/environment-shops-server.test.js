import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
test('four-character shop storage retains IDs, validates coverage and renews only complete successful checks',()=>{assert.match(execFileSync('php',['tests/helpers/environment-shops.php'],{encoding:'utf8'}),/checks passed/);});
