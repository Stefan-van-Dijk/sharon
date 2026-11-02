import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { offlineAssets } from './release-assets.mjs';
export function buildSite(root = process.cwd(), output = resolve(root, '_site')) {
  root = resolve(root); output = resolve(output);
  if (output === root || !output.startsWith(root + sep)) throw Error('Uitvoer moet een submap van de bronmap zijn.');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  try {
    for (const name of ['src', 'assets', 'vendor', 'index.html', 'manifest.webmanifest', 'service-worker.js']) {
      cpSync(join(root, name), join(output, name), { recursive: true });
    }
    if (existsSync(join(root, 'CNAME'))) cpSync(join(root, 'CNAME'), join(output, 'CNAME'));
    writeFileSync(join(output, '.nojekyll'), '');
    // Every local reference in the shipped shell, precache and module graph must exist.
    function walk(dir) {
      return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
    }
    const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
    const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
    const assets = offlineAssets(root, version);
    const declaredAssets = JSON.parse(readFileSync(join(output, 'service-worker.js'), 'utf8').match(/const CORE = (\[[\s\S]*?\]);/)?.[1] || 'null');
    for (const url of declaredAssets || []) if (!existsSync(resolve(output, url.split('?')[0]))) throw Error(`Ontbrekend releasebestand: ${url}`);
    const hashes = Object.fromEntries(assets.map(url => {
      const file = resolve(output, url.split('?')[0]);
      if (!existsSync(file)) throw Error(`Ontbrekend releasebestand: ${url}`);
      return [url, hash(file)];
    }));
    const workerPath = join(output, 'service-worker.js');
    const worker = readFileSync(workerPath, 'utf8');
    const declared = JSON.parse(worker.match(/const CORE = (\[[\s\S]*?\]);/)?.[1] || 'null');
    if (JSON.stringify(declared) !== JSON.stringify(assets)) throw Error('Offline-moduleclosure gewijzigd: voer scripts/set-version.mjs uit.');
    const releaseId = createHash('sha256').update(worker + JSON.stringify(hashes)).digest('hex').slice(0, 20);
    writeFileSync(workerPath, worker.replace('const ASSET_HASHES = null;', `const ASSET_HASHES = ${JSON.stringify(hashes)};`).replace('__SHARON_RELEASE_ID__', releaseId));
    writeFileSync(join(output, 'offline-manifest.json'), JSON.stringify({ version, releaseId, assets: hashes }, null, 2) + '\n');
    const files = walk(output);
    for (const file of files.filter(f => /\.(js|html|webmanifest)$/.test(f) && !f.includes(`${sep}vendor${sep}`))) {
      const code = readFileSync(file, 'utf8');
      const specs = file.endsWith('.js')
        ? [...code.matchAll(/\b(?:import|export)\s+(?:[^'"]*?\s+from\s*)?['"](\.[^'"]+)['"]|\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)].map(m => m[1] || m[2])
        : [...code.matchAll(/(?:src|href)=["'](\.[^"']+)["']/g)].map(m => m[1]);
      if (file.endsWith('service-worker.js')) specs.push(...[...code.matchAll(/['"](\.\/[^'"`]+)['"]/g)].map(m => m[1]));
      if (file.endsWith('.webmanifest')) specs.push(...JSON.parse(code).icons.map(icon => './' + icon.src.replace(/^\.\//, '')));
      for (const spec of specs) {
        const target = resolve(file, '..', decodeURIComponent(spec.split(/[?#]/)[0]));
        if (target !== output && !target.startsWith(output + sep)) throw Error(`Pad buiten artifact: ${spec}`);
        if (!existsSync(target)) throw Error(`Ontbrekend releasebestand: ${relative(output, file)} -> ${spec}`);
      }
    }
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) throw Error('Checkout en workflow-SHA verschillen.');
    const manifest = { sha, version: JSON.parse(readFileSync(join(root, 'package.json'))).version,
      node: process.version, files: Object.fromEntries(files.sort().map(file => [relative(output, file).split(sep).join('/'), createHash('sha256').update(readFileSync(file)).digest('hex')])) };
    writeFileSync(join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = buildSite();
  console.log(`Releasepakket ${manifest.version} · ${manifest.sha} · ${Object.keys(manifest.files).length} bestanden`);
}
