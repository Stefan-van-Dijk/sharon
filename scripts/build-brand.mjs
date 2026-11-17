import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Keep the approved mark as the source of truth; preserve the wordmark letters.
export function buildWordmark(mark, wordmark) {
  const defs = mark.match(/<defs>([\s\S]*?)<\/defs>/)?.[1];
  if (!defs) throw Error('Logo mist SVG-definities.');
  const parts = ['outer-arcs', 'inner-ring', 'diagonal-beam', 'center-crescent'];
  const fragments = parts.map(id => {
    const group = mark.match(new RegExp(`<g id="${id}"[^>]*>[\\s\\S]*?<\\/g>`))?.[0];
    if (!group) throw Error(`Logo mist laag ${id}.`);
    return `<g id="logo-${id}" transform="translate(143.65 55.2) scale(.043)">${group}</g>`;
  }).join('\n');
  // The standalone mark is centred at 500,500; its child layers use local 0,0.
  const generated = `<g id="logo" color="#171a23" fill="currentColor"><defs>${defs}</defs>${fragments}</g>`;
  const block = /<!-- approved-logo:start -->[\s\S]*?<!-- approved-logo:end -->|<g id="logo"[^>]*>[\s\S]*?<\/g>/;
  if (!block.test(wordmark)) throw Error('Woordmerk mist logo-slot.');
  return wordmark.replace(block, `<!-- approved-logo:start -->${generated}<!-- approved-logo:end -->`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = 'assets/sharon-wordmark.svg';
  writeFileSync(path, buildWordmark(readFileSync('assets/sharon-logo.svg', 'utf8'), readFileSync(path, 'utf8')));
}
