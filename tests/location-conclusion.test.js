import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATION_TYPES } from '../src/core/location/LocationHierarchy.js';
import {
  locationConclusion, typeLocationConclusion
} from '../src/ui/LocationConclusion.js';
import { readFile } from 'node:fs/promises';

const point = { lat: 52, lng: 6 };
const observed = { lat: 52, lng: 6, accuracy: 8, at: 1_000_000 };

test('conclusion is grounded in a recent cached GPS fix', () => {
  assert.equal(locationConclusion('Thuis',point,observed,100,1_000_100),'Je bent nu bij Thuis.');
  const outside = { ...observed, lat: 52.001 };
  assert.match(locationConclusion('Werk',point,outside,20,1_000_100),
    /^Je bent ongeveer 110 m van Werk\.$/);
  const fringe = { ...observed, lat: 52.0006, accuracy: 50 };
  assert.equal(locationConclusion('Klant',point,fringe,80,1_000_100),
    'Je bent in de buurt van Klant.');
  assert.equal(locationConclusion('Thuis',point,observed,100,2_000_000),
    'Je bekijkt Thuis.');
  assert.equal(locationConclusion('Thuis',point,null,100),'Je bekijkt Thuis.');
  assert.equal(locationConclusion('',point,null,100),'Waar is deze plek?');
});

test('location types include practical destinations while preserving old identifiers', () => {
  const names = new Map(LOCATION_TYPES);
  for (const key of ['home','work','business','private','other','customer','parking',
    'fuel','supermarket','restaurant','school','sport','healthcare','construction']) {
    assert.ok(names.has(key),key);
  }
  assert.equal(names.get('fuel'),'Tankstation');
  assert.equal(names.get('parking'),'Parkeren');
  assert.ok(LOCATION_TYPES.findIndex(row=>row[0]==='home') >
    LOCATION_TYPES.findIndex(row=>row[0]==='fuel'),
    'Thuis must not dominate the first visible categories');
});

test('typewriter works as reduced-motion static text and cancels cleanly', async () => {
  const node = { textContent:'', isConnected:true,
    classes:new Set(), classList:{
      add() { node.classes.add('is-typing'); },
      remove() { node.classes.delete('is-typing'); }
    }
  };
  typeLocationConclusion(node,'Je bent bij Thuis.',{reducedMotion:true});
  assert.equal(node.textContent,'Je bent bij Thuis.');
  const cancel = typeLocationConclusion(node,'Nieuwe conclusie.',{speed:1});
  assert.equal(node.textContent,'N');
  assert.ok(node.classes.has('is-typing'));
  cancel();
  assert.ok(!node.classes.has('is-typing'));
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(node.textContent,'N','cancelled animations must not continue typing');
});

test('one-line conclusion replaces multi-question heading and categories scroll sideways', async () => {
  const code = await readFile(new URL('../src/ui/LocationOnboardingFlow.js', import.meta.url),'utf8');
  const styles = await readFile(new URL('../index.html', import.meta.url),'utf8');
  const shell = await readFile(new URL('../src/ui/Shell.js', import.meta.url),'utf8');
  const swipe = await readFile(new URL('../src/ui/SwipeHome.js',import.meta.url),'utf8');
  assert.ok(code.includes('data-location-conclusion'));
  assert.ok(code.includes('typeLocationConclusion(conclusionElement'));
  assert.ok(code.includes('location?.latest'));
  assert.ok(!code.includes('Is dit de plek?'));
  assert.ok(!code.includes('Controleer of de locatie klopt'));
  assert.ok(styles.includes('.sh-location-reference-types{'));
  assert.ok(styles.includes('scroll-snap-type:x proximity'));
  assert.ok(styles.includes('border-right:1px solid'));
  assert.ok(shell.includes("outlet.querySelector('.location-editor-view [data-back]')"));
  assert.ok(swipe.includes('[data-type-chips]'));
});

test('onboarding-like position map shows GPS control and 2-meter nudge buttons, but no zoom buttons', async () => {
  const code = await readFile(new URL('../src/ui/LocationOnboardingFlow.js',import.meta.url),'utf8');
  assert.ok(code.includes('gpsButton.hidden = false'));
  assert.ok(code.includes('data-sh-move=\"north\"'));
  assert.ok(!code.includes("data-zoom-in"));
  assert.ok(!code.includes("data-zoom-out"));
});
