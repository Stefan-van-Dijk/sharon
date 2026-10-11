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
  assert.ok(css.includes('@media (min-width:900px) and (pointer:fine)'));
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
  assert.ok(css.includes('.environment-desktop-style-toggle{display:none}'));
  assert.ok(css.includes('position:absolute;left:16px;bottom:16px;z-index:25;'));
  assert.ok(css.includes('width:40px;min-width:40px;height:40px;min-height:40px;'));
  assert.ok(css.includes('display:block;width:10px;height:10px;border-radius:50%;'));
  assert.ok(css.includes('background:#111;'));
  assert.ok(css.includes('.environment-desktop-style-toggle:focus-visible{'));
  assert.ok(controller.includes("listen(desktopStyleToggle, 'click'"));
  assert.ok(controller.includes('setStyleMode(host.hidden)'));
  assert.ok(controller.includes("desktopStyleToggle?.setAttribute('aria-pressed', String(active))"));
  assert.ok(controller.includes("desktopStyleToggle?.setAttribute('aria-expanded', String(active))"));
  assert.ok(controller.includes("event.key === 'Escape'"));
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
