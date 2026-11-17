import test from 'node:test';
import {execFileSync} from 'node:child_process';

test('The central product library and shared categories respect product identity and membership',()=>{
 execFileSync('php',['tests/helpers/shop-library.php'],{stdio:'pipe'});
});
