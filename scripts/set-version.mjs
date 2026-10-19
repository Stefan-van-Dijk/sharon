import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { offlineAssets } from './release-assets.mjs';
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('Gebruik: node scripts/set-version.mjs 0.3.56');
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}
for (const file of ['index.html', ...walk('src').filter(f => f.endsWith('.js')), 'tests/helpers/app-harness.mjs', 'tests/integration/app.test.mjs']) {
  let code = readFileSync(file, 'utf8').replace(/\?v=\d+\.\d+\.\d+/g, '?v=' + version);
  if (file.endsWith('.js')) code = code.replace(/((?:from\s*|import\s*(?:\(\s*)?)['"])(\.[^'"]+\.js)(['"])/g, `$1$2?v=${version}$3`);
  code = code.replace(/const APP_VERSION = '[^']+'/, `const APP_VERSION = '${version}'`);
  writeFileSync(file, code);
}
for (const file of ['package.json', 'package-lock.json']) {
  const json = JSON.parse(readFileSync(file)); json.version = version;
  if (json.packages) json.packages[''].version = version;
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}
let worker = readFileSync('service-worker.js', 'utf8').replace(/const BUILD = '[^']+'/, `const BUILD = '${version}'`);
worker = worker.replace(/const CORE = \[[\s\S]*?\];/, `const CORE = ${JSON.stringify(offlineAssets(process.cwd(), version), null, 2)};`);
writeFileSync('service-worker.js', worker);
