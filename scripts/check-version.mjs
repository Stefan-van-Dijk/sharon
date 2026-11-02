import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { offlineAssets } from './release-assets.mjs';
const version = JSON.parse(readFileSync('package.json')).version;
const lock = JSON.parse(readFileSync('package-lock.json'));
if (lock.version !== version || lock.packages[''].version !== version) throw Error('Package-lock wijkt af van packageversie');
const worker = readFileSync('service-worker.js', 'utf8');
const shell = readFileSync('src/ui/Shell.js', 'utf8');
if (!worker.includes(`const BUILD = '${version}'`) || !shell.includes(`const APP_VERSION = '${version}'`)) throw Error('Buildidentiteit wijkt af');
const core = JSON.parse(worker.match(/const CORE = (\[[\s\S]*?\]);/)?.[1] || 'null');
if (JSON.stringify(core) !== JSON.stringify(offlineAssets(process.cwd(), version))) throw Error('Offline-moduleclosure wijkt af; voer scripts/set-version.mjs uit');
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
for (const file of ['index.html', ...walk('src').filter(f => f.endsWith('.js'))]) {
  const code = readFileSync(file, 'utf8');
  for (const match of code.matchAll(/\?v=([\d.]+)/g)) if (match[1] !== version) throw Error(`${file}: oude queryversie ${match[1]}`);
  for (const match of code.matchAll(/['"](\.{1,2}\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g)) {
    if (!match[1].endsWith('?v=' + version)) throw Error(`${file}: niet-canonieke module-URL ${match[1]}`);
  }
}
console.log(`Volledige PWA-release ${version}: canonieke module-URL's en ${core.length} offline-assets.`);
