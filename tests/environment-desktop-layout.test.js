import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = new URL('../index.html', import.meta.url);
const renderer = new URL('../src/ui/EnvironmentMapLibre.js', import.meta.url);
const editor = new URL('../src/ui/EnvironmentAppearanceEditor.js', import.meta.url);

test('desktop environment map is full-width while other modules keep their document column', async () => {
  const css = await readFile(html,'utf8');
  assert.ok(css.includes('.app-stage[data-view="detail"] .app-view>.module-view{'));
  assert.ok(css.includes('width:100%;max-width:560px;margin:0 auto;'));
  assert.ok(css.includes('.app-stage.is-environment .app-view>.environment-view{'));
  assert.ok(css.includes('width:100%;max-width:none;height:100%;min-height:0;'));
  assert.ok(css.includes('margin:0;padding:0;overflow:hidden;'));
  assert.ok(css.includes('@media (min-width:900px){'));
  assert.ok(css.includes('position:absolute;inset:0;width:100%;height:100%;'));
  assert.ok(css.includes('width:min(440px,calc(100vw - 32px));'));
  assert.ok(css.includes('width:min(420px,calc(100vw - 88px));'));
});

test('discreet 10px black dot has larger pointer hit target and keyboard accessibility', async () => {
  const [css,map,controller] = await Promise.all([
    readFile(html,'utf8'), readFile(renderer,'utf8'), readFile(editor,'utf8')
  ]);
  assert.ok(map.includes('data-desktop-style-toggle'));
  assert.ok(map.includes('aria-label="Kaartstijl aanpassen"'));
  assert.ok(map.includes('aria-pressed="false" aria-expanded="false"'));
  assert.ok(css.includes('.app-stage.is-environment .environment-desktop-style-toggle{'));
  assert.ok(css.includes('.app-stage.is-environment .environment-desktop-style-toggle{display:none}'));
  assert.ok(css.includes('display:grid;place-items:center;position:absolute;'));
  assert.ok(css.includes('left:max(16px,env(safe-area-inset-left));'));
  assert.ok(css.includes('bottom:max(16px,env(safe-area-inset-bottom));'));
  assert.ok(css.includes('z-index:25;width:44px;min-width:44px;height:44px;min-height:44px;'));
  assert.ok(css.includes('pointer-events:auto;touch-action:manipulation;'));
  assert.ok(map.includes('aria-controls="environment-style-editor"'));
  assert.ok(controller.includes('id="environment-style-editor"'));
  assert.ok(css.includes('display:block;width:10px;height:10px;border-radius:50%;'));
  assert.ok(css.includes('background:#111;'));
  assert.ok(css.includes('.environment-desktop-style-toggle:focus-visible{'));
  assert.ok(controller.includes("listen(desktopStyleToggle, 'click'"));
  assert.ok(controller.includes('setStyleMode(host.hidden)'));
  assert.ok(controller.includes("desktopStyleToggle?.setAttribute('aria-pressed', String(active))"));
  assert.ok(controller.includes("desktopStyleToggle?.setAttribute('aria-expanded', String(active))"));
  assert.ok(controller.includes("event.key === 'Escape'"));
  assert.ok(controller.includes("'Kaartstijl sluiten' : 'Kaartstijl aanpassen'"));
});

test('mobile readout swipe and map rendering remain intact', async () => {
  const [css,controller,map] = await Promise.all([
    readFile(html,'utf8'),readFile(editor,'utf8'),readFile(renderer,'utf8')
  ]);
  assert.ok(css.includes('.environment-readout-track'));
  assert.ok(controller.includes("listen(positionSide, 'touchstart', beginSwipe"));
  assert.ok(controller.includes("listen(positionSide, 'touchmove', moveSwipe"));
  assert.ok(controller.includes("if (horizontal && dx >= 58) setStyleMode(true)"));
  assert.ok(map.includes('new ResizeObserver('));
  assert.ok(map.includes('map.resize()'));
});

test('narrow screens hide dot and hit area; swipe opens style while wide screens keep button', async () => {
  const [css,controller] = await Promise.all([readFile(html,'utf8'),readFile(editor,'utf8')]);
  assert.ok(css.includes('.app-stage.is-environment .environment-desktop-style-toggle{display:none}'));
  const desktop = css.slice(css.indexOf('    @media (min-width:900px){'));
  assert.ok(desktop.includes('.app-stage.is-environment .environment-desktop-style-toggle{'));
  assert.ok(desktop.includes('display:grid;place-items:center;position:absolute;'));
  assert.ok(!css.includes('bottom:calc(max(12px,env(safe-area-inset-bottom)) + 108px);'));
  assert.ok(!css.includes('@media (min-width:900px) and (pointer:fine)'));
  assert.ok(controller.includes("listen(positionSide, 'touchstart', beginSwipe"));
  assert.ok(controller.includes("listen(positionSide, 'touchmove', moveSwipe"));
  assert.ok(controller.includes("if (horizontal && dx >= 58) setStyleMode(true)"));
  assert.ok(controller.includes("listen(desktopStyleToggle, 'click'"));
});

test('only available object styling categories are shown', async () => {
  const groups = await readFile(new URL('../src/ui/EnvironmentAppearance.js', import.meta.url),'utf8');
  for (const name of ['Gemalen','Sluizen','Stuwen']) assert.ok(!groups.includes(name));
  for (const name of ['Bruggen','Tunnels','Pieren','Dammen']) assert.ok(groups.includes(name));
});
