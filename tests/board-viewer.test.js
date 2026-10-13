import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceBearing, sectionsFromWikipediaHtml, safeUrl } from '../src/ui/BoardViewer.js';

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
