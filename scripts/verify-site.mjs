import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export function verifySite(root = resolve('_site')) {
  const manifest = JSON.parse(readFileSync(join(root, 'release.json')));
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [relative(root, join(dir, e.name)).replaceAll('\\', '/')]); }
  const actual = walk(root).filter(name => name !== 'release.json').sort();
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(manifest.files).sort())) throw Error('Bestandslijst releasepakket gewijzigd');
  for (const name of actual) {
    if (createHash('sha256').update(readFileSync(join(root, name))).digest('hex') !== manifest.files[name]) throw Error(`Releasepakket gewijzigd: ${name}`);
  }
  if (process.env.GITHUB_SHA && manifest.sha !== process.env.GITHUB_SHA) throw Error('Release-SHA wijkt af');
  console.log(`Release-inhoud gecontroleerd: ${manifest.sha}`);
  return manifest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) verifySite();
