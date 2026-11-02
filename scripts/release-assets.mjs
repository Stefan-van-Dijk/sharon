import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
export function offlineAssets(root, version) {
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
  }
  const paths = ['index.html', 'manifest.webmanifest', ...['src', 'assets', 'vendor'].flatMap(dir => walk(join(root, dir)).map(file => relative(root, file).replaceAll('\\', '/')))]
    .filter(path => !path.endsWith('-LICENSE.txt'));
  return paths.flatMap(path => path.endsWith('.js') ? [`./${path}?v=${version}`]
    : path === 'index.html' ? ['./index.html'] : [`./${path}`, `./${path}?v=${version}`]).sort();
}
