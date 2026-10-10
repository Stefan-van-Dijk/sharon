import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = new URL('../index.html', import.meta.url);
const editorFile = new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url);

test('every detail view is edge-to-edge with safe content gutters and unified fixed header', async () => {
  const css = await readFile(html, 'utf8');
  assert.match(css, /\.app-stage\[data-view="detail"\]\{[\s\S]*?width:100%;height:100dvh;min-height:100dvh;padding:0!important/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-frame\{[\s\S]*?height:100dvh!important;/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-view\{[\s\S]*?overflow-y:auto;/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-view>\.module-view\{[\s\S]*?padding:calc\(env\(safe-area-inset-top\) \+ 54px\)/);
  assert.match(css, /max\(22px,env\(safe-area-inset-right\)\)/);
  assert.match(css, /max\(22px,env\(safe-area-inset-left\)\)/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-header\{[\s\S]*?height:calc\(env\(safe-area-inset-top\) \+ var\(--sharon-header-height\)\)/);
  assert.match(css, /\.app-stage\.is-environment \.app-view\{\s*padding:0;overflow:hidden;transform:none;/);
  assert.ok(css.includes('.app-header.is-detail .location-pulse{display:none;'));
});

test('compact style editor has all 11 categories in four columns and line icons only', async () => {
  const [css,editor] = await Promise.all([readFile(html, 'utf8'),readFile(editorFile, 'utf8')]);
  assert.match(css, /\.environment-style-groups\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:4px\}/);
  assert.match(css, /\.environment-style-group\{height:52px;border-radius:9px;overflow:visible\}/);
  assert.match(css, /max-height:min\(70dvh,calc\(100dvh - env\(safe-area-inset-top\) - 175px\)\)/);
  assert.match(css, /\.environment-style-dash-choices button\{[\s\S]*?height:44px;/);
  assert.doesNotMatch(editor, /<span>\$\{item\.label\}<\/span>/);
  assert.match(editor, /aria-label="\$\{item\.label\}"/);
  assert.match(editor, /<small data-dash-default>Standaard<\/small>/);
  assert.match(editor, /APPEARANCE_GROUPS/);
});

test('color selectors show actual selected colors and a separate edit affordance', async () => {
  const [css,editor] = await Promise.all([readFile(html, 'utf8'),readFile(editorFile, 'utf8')]);
  assert.match(css, /\.environment-style-fill-dot::after,[\s\S]*?content:"✎"/);
  assert.match(css, /background:var\(--swatch-color,#e5e5e8\)/);
  assert.match(editor, /strokeInput\.closest\('label'\)\?\.style\.setProperty\('--swatch-color', values\.stroke\)/);
  assert.match(editor, /input\.closest\('label'\)\.style\.setProperty\('--swatch-color', valuesFor\(group\)\.fill\)/);
  assert.match(editor, /ENVIRONMENT_APPEARANCE_KEY/);
});
