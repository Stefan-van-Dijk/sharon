import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enhanceLocationEditor } from '../src/ui/LocationOnboardingFlow.js';

const read = async name => readFile(new URL(name, import.meta.url), 'utf8');

test('guided location creation and editing use the same onboarding flow', async () => {
  const locations = await read('../src/ui/LocationsView.js');
  const guided = await read('../src/ui/LocationOnboardingFlow.js');
  assert.equal(typeof enhanceLocationEditor, 'function');
  assert.ok(locations.includes('enhanceLocationEditor(root, { isNew, skipInitialFocus: useGps })'));
  assert.ok(guided.includes("const QUESTIONS = ["));
  assert.ok(guided.includes("'Waar ligt deze plek?'"));
  assert.ok(guided.includes("'Hoe zullen we deze plek noemen?'"));
  assert.ok(guided.includes("'Klopt alles zo?'"));
  assert.ok(guided.includes("form.prepend(flow)"));
});

test('the guided editor keeps the original fields, actions and one save form', async () => {
  const guided = await read('../src/ui/LocationOnboardingFlow.js');
  const locations = await read('../src/ui/LocationsView.js');
  assert.ok(guided.includes("form.querySelector('[data-editor-status]')"));
  assert.ok(guided.includes("form.querySelector('[type=\"submit\"]')"));
  assert.ok(guided.includes('save.classList.add'));
  assert.ok(guided.includes('focusTextField(target)'));
  assert.ok(guided.includes('focusTextField(trigger.querySelector'));
  assert.ok(guided.includes("event.stopImmediatePropagation()"));
  assert.ok(guided.includes("step === QUESTIONS.length - 1"));
  assert.ok(guided.includes("root.querySelector('[data-lookup]')?.click()"));
  assert.ok(guided.includes("if (extra) scenes[5].append(extra)"));
  assert.ok(guided.includes("if (merge) scenes[5].append(merge)"));
  assert.ok(locations.includes("if (useGps) root.querySelector('[data-current-gps]').click()"));
  assert.ok(locations.includes('await store.put(\'objects\', saved)'));
});

test('Sharon shares onboarding typography and preserves reduced-motion support', async () => {
  const html = await read('../index.html');
  const sw = await read('../service-worker.js');
  assert.ok(html.includes('.sh-location-guided-question p{'));
  assert.ok(html.includes('.sh-location-guided [hidden]{display:none!important}'));
  assert.ok(html.includes('.sh-location-guided-flow{'));
  assert.ok(html.includes('@media (prefers-reduced-motion:reduce)'));
  assert.ok(sw.includes("LocationOnboardingFlow.js?v=0.1.93"));
  assert.ok(sw.includes("const BUILD = '0.1.93'"));
});
