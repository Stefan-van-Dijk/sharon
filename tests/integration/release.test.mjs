import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSite } from '../../scripts/build-site.mjs';
import { verifySite } from '../../scripts/verify-site.mjs';
import { appHarness } from '../helpers/app-harness.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve('.release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['src', 'assets', 'vendor', 'index.html', 'manifest.webmanifest', 'service-worker.js', 'package.json', 'scripts', 'tests']) cpSync(name, join(root, name), { recursive: true });
  return root;
}
for (const failure of ['syntax', 'test']) test(`Releasepoort stopt vóór pakketbouw bij ${failure}fout`, t => {
  const root = fixture(t);
  if (failure === 'syntax') writeFileSync(join(root, 'src/ui/SkeletonDemoView.js'), 'export const broken = ;');
  else writeFileSync(join(root, 'tests/intentional.test.js'), "import test from 'node:test'; test('bewuste fout', () => { throw Error('RELEASE_MUST_STOP'); });");
  // A nested Node test runner otherwise inherits child-v8 and skips every test.
  const env = { ...process.env, FIXTURE_ROOT: root };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', 'npm --prefix "$FIXTURE_ROOT" run verify 2>&1 | tee verification.log'], { cwd: root, env, encoding: 'utf8', timeout: 90000 });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0, (result.stdout + result.stderr).slice(-3000));
  assert.match(result.stdout + result.stderr, failure === 'syntax' ? /SyntaxError/ : /RELEASE_MUST_STOP/);
  assert.equal(existsSync(join(root, '_site')), false);
});

test('Pakket weigert een ontbrekend precachebestand en ruimt onvolledige uitvoer op', t => {
  const root = fixture(t);
  rmSync(join(root, 'vendor/zxing-0.21.3.min.js'));
  assert.throws(() => buildSite(root), /Ontbrekend releasebestand/);
  assert.equal(existsSync(join(root, '_site')), false);
});

test('Hashes ontdekken gewijzigde inhoud en onverwachte bestanden', t => {
  const root = fixture(t), output = join(root, '_site');
  const manifest = buildSite(root);
  assert.equal(verifySite(output).sha, manifest.sha);
  const index = readFileSync(join(output, 'index.html'));
  writeFileSync(join(output, 'index.html'), 'gewijzigd');
  assert.throws(() => verifySite(output), /Releasepakket gewijzigd/);
  writeFileSync(join(output, 'index.html'), index);
  writeFileSync(join(output, 'onverwacht.txt'), 'niet getest');
  assert.throws(() => verifySite(output), /Bestandslijst/);
});

test('Echte opstarttest detecteert een defect in de meegeïmporteerde demo', async t => {
  const root = fixture(t);
  buildSite(root);
  writeFileSync(join(root, '_site/src/ui/SkeletonDemoView.js'), 'export const broken = ;');
  const app = await appHarness({ root: join(root, '_site') }); t.after(() => app.close());
  await assert.rejects(app.boot(), { name: 'SyntaxError' });
});
