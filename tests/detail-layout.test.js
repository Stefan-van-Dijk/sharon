import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = new URL('../index.html', import.meta.url);
const editorFile = new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url);

test('detail pages restore safe horizontal gutters while lists scroll underneath the header', async () => {
  const css = await readFile(html, 'utf8');
  assert.match(css, /\.app-stage\[data-view="detail"\]:not\(\.is-environment\) \.app-view>\.module-view\{[\s\S]*?padding-top:calc\(env\(safe-area-inset-top\) \+ 54px\)/);
  assert.match(css, /padding-right:max\(22px,env\(safe-area-inset-right\)\)/);
  assert.match(css, /padding-left:max\(22px,env\(safe-area-inset-left\)\)/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-view\{position:absolute;inset:0;[\s\S]*?overflow-y:auto;/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-header\{position:absolute;/);
  assert.match(css, /\.app-stage\.is-environment \.app-view\{padding:0;overflow:hidden\}/);
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
