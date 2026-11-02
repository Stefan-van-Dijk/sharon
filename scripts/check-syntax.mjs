import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(m?js)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}
for (const file of [...walk('src'), ...walk('scripts'), ...walk('tests'), 'service-worker.js']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log('JavaScript-syntaxis gecontroleerd.');
