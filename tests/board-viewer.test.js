import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceBearing, sectionsFromWikipediaHtml, safeUrl, articleProgressDotCount, fetchWikipediaBoard } from '../src/ui/BoardViewer.js';

test('board compass gives north bearing and accurate distance', () => {
  const result = distanceBearing({ lat: 52, lng: 5 }, { lat: 52.01, lng: 5 });
  assert.ok(result.distance > 1100 && result.distance < 1120);
  assert.ok(result.bearing < 0.01 || result.bearing > 359.99);
});
test('board compass returns no direction without GPS', () => {
  assert.equal(distanceBearing(null, { lat: 52, lng: 5 }), null);
});
test('Wikipedia board falls back to summary if DOMParser is unavailable', () => {
  const sections = sectionsFromWikipediaHtml('', {
    title: 'Stonehenge', image: 'https://upload.wikimedia.org/example.jpg',
    description: 'Prehistorisch monument.'
  });
  assert.equal(sections[0].title, 'Stonehenge');
  assert.equal(sections[0].text, 'Prehistorisch monument.');
  assert.equal(sections[0].image, 'https://upload.wikimedia.org/example.jpg');
});

test('Wikimedia protocol-relative images are accepted and unsafe URLs rejected', () => {
  assert.equal(safeUrl('//upload.wikimedia.org/wikipedia/commons/photo.jpg', true),
    'https://upload.wikimedia.org/wikipedia/commons/photo.jpg');
  assert.equal(safeUrl('javascript:alert(1)', true), '');
});

test('MediaWiki root-relative image URLs resolve to Wikimedia uploads', () => {
  assert.equal(safeUrl('/wikipedia/commons/thumb/a/ab/Foto.jpg/480px-Foto.jpg', true),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Foto.jpg/480px-Foto.jpg');
});

test('article indicator stays fixed-length but represents article length', () => {
  assert.equal(articleProgressDotCount(80), 2);
  assert.equal(articleProgressDotCount(600), 4);
  assert.equal(articleProgressDotCount(6000), 13);
});

test('full Wikipedia Board resolves article image filenames using imageinfo', async () => {
  const requests = [];
  const fetcher = async url => {
    requests.push(String(url));
    if (String(url).includes('action=parse')) {
      return { ok: true, json: async () => ({ parse: {
        text: '<p>Een uitgebreide tekst over deze mooie locatie en de geschiedenis van deze plek.</p>',
        images: ['Foto-van-de-plek.jpg']
      } }) };
    }
    return { ok: true, json: async () => ({ query: { pages: [{
      imageinfo: [{ width: 900, height: 600,
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/example/Foto-van-de-plek.jpg/900px-Foto-van-de-plek.jpg' }]
    }] } }) };
  };
  const sections = await fetchWikipediaBoard({ properties: {
    title: 'Voorbeeld', description: 'Een introductie over het gebouw.',
    url: 'https://nl.wikipedia.org/?curid=123'
  } }, { fetcher });
  assert.equal(requests.length, 2);
  assert.ok(requests[1].includes('prop=imageinfo'));
  assert.ok(sections[0].image.includes('Foto-van-de-plek.jpg'));
});
