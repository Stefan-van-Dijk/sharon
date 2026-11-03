import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_CATEGORIES, MAP_CATEGORY_PATHS, categoryIconSvg } from '../src/core/chains/ChainCategories.js';

test('shop and Wikipedia categories use one monochrome line icon language', () => {
  const keys=[...Object.keys(SHOP_CATEGORIES),'erfgoed','bouw','natuur','cultuur','vervoer','overig'];
  for (const key of keys) {
    assert.ok(MAP_CATEGORY_PATHS[key], key);
    const svg=categoryIconSvg(key,18);
    assert.match(svg, /<svg[^>]+viewBox="0 0 24 24"/);
    assert.match(svg, /fill="none"[^>]+stroke="currentColor"/);
    assert.ok(svg.includes(MAP_CATEGORY_PATHS[key]));
  }
  assert.equal(categoryIconSvg('unknown').includes(MAP_CATEGORY_PATHS.other),true);
  assert.equal(categoryIconSvg('food',300).includes('width="32"'),true);
});
