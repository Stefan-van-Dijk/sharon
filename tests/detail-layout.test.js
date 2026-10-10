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
  assert.match(css, /body\.sharon-shell-active\.sharon-detail-active\{\s*height:100dvh;overflow:hidden;/);
  assert.match(css, /html:has\(body\.sharon-detail-active\)\{overflow:hidden\}/);
  assert.match(css, /\.app-stage\[data-view="detail"\] \.app-header\{\s*position:fixed;/);
  const shell = await readFile(new URL('../src/ui/Shell.js', import.meta.url), 'utf8');
  assert.ok(shell.includes("document.body.classList.toggle('sharon-detail-active', detail)"));
});

test('glass appearance editor has six groups, a four-column technical raster and compact controls', async () => {
  const [css,editor] = await Promise.all([readFile(html, 'utf8'),readFile(editorFile, 'utf8')]);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:1px;/);
  assert.match(css, /max-height:min\(65dvh,calc\(100dvh - env\(safe-area-inset-top\) - 178px\)\)/);
  assert.ok(css.includes('.environment-style-tabs button[aria-pressed="true"]'));
  assert.ok(css.includes('.environment-style-flyout[hidden]{display:none!important}'));
  assert.ok(editor.includes('data-style-sections'));
  assert.ok(editor.includes('data-style-parent'));
  assert.ok(editor.includes('data-style-inherit'));
  assert.ok(editor.includes('data-style-dash'));
  assert.ok(editor.includes("small.textContent = 'Standaard'"));
  assert.ok(editor.includes('data-style-groups'));
  assert.ok(editor.includes("button.setAttribute('aria-label', group.label)"));
});

test('group and child colors use native iOS color inputs and rectangular swatches', async () => {
  const [css,editor] = await Promise.all([readFile(html, 'utf8'),readFile(editorFile, 'utf8')]);
  assert.ok(css.includes('.environment-color-swatch input[type=color]'));
  assert.ok(css.includes('background:var(--style-color,#d0d0d5)'));
  assert.ok(editor.includes('data-style-fill'));
  assert.ok(editor.includes('data-style-stroke'));
  assert.ok(editor.includes('data-style-fill-hex'));
  assert.ok(editor.includes('data-inherit-field'));
  assert.ok(editor.includes('ENVIRONMENT_APPEARANCE_KEY'));
  assert.doesNotMatch(css, /environment-style-fill-dot/);
});
