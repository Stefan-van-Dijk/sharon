import {test, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve, sep} from 'node:path';

let server, base;
test.beforeAll(async () => {
  const root = resolve('_site');
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://local').pathname;
    if (path === '/') {
      // Exercise the shipped intro markup/CSS and Boot transition without profile setup.
      const html = readFileSync(resolve(root, 'index.html'), 'utf8')
        .replace(/<script type="module" src="[^\"]+"><\/script>/, '');
      res.setHeader('Content-Type', 'text/html'); res.end(html); return;
    }
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + sep)) {res.writeHead(403).end(); return;}
    try {
      res.setHeader('Content-Type', path.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript');
      res.end(readFileSync(file));
    } catch {res.writeHead(404).end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(() => server.close());

test('intro resolves all SVG layers and assembles the approved mark', async ({page}, info) => {
  const failures = [];
  page.on('response', r => {if(r.status() >= 400) failures.push(r.url());});
  await page.goto(base);
  const layers = page.locator('[data-brand-motion] .logo-layer');
  await expect(layers).toHaveCount(4);
  await expect.poll(() => layers.evaluateAll(nodes => nodes.every(n => n.getBBox().width > 0))).toBe(true);
  await page.evaluate(async () => {
    const version = document.querySelector('.vector-logo image').getAttribute('href').match(/v=([0-9.]+)/)[1];
    const {runReturningIntro} = await import(`./src/ui/Boot.js?v=${version}`);
    await runReturningIntro(document, performance.now() - 1000, 'Test');
  });
  await expect(page.locator('[data-brand-motion]')).toHaveClass(/is-final/);
  expect(await layers.evaluateAll(nodes => nodes.every(n => getComputedStyle(n).transform === 'none' && getComputedStyle(n).opacity === '1'))).toBe(true);
  expect(failures).toEqual([]);
  await page.locator('[data-brand-motion]').screenshot({path:info.outputPath('assembled-logo.png')});
});

test('reduced motion shows assembled layers without movement', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  expect(await page.locator('.logo-layer').evaluateAll(nodes => nodes.every(n => {
    const style = getComputedStyle(n);
    return style.transform === 'none' && style.transitionDuration === '0s' && style.opacity === '1';
  }))).toBe(true);
});

test('standalone animation layers preserve transparent ring gaps', async ({page}) => {
  await page.goto(base);
  const pixels = await page.evaluate(async () => {
    const check = async (part, points) => {
      const image = new Image();
      image.src = `./assets/sharon-logo-${part}.svg`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 820;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, 820, 820);
      return points.map(([x,y]) => ctx.getImageData(x,y,1,1).data[3]);
    };
    return {
      outer: await check('outer-arcs', [[410,19], [110,159]]),
      inner: await check('inner-ring', [[67,410], [701,228]]),
      center: await check('center-crescent', [[460,360], [338,410]])
    };
  });
  for (const [solid, gap] of Object.values(pixels)) {
    expect(solid).toBeGreaterThan(240);
    expect(gap).toBe(0);
  }
});
