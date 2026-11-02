import test from 'node:test';
import assert from 'node:assert/strict';
import { focusTextField } from '../src/ui/TextInputFocus.js';
import { readFile } from 'node:fs/promises';

test('text focus happens synchronously and positions caret at end for editing', () => {
  const calls = [];
  const input = {
    isConnected: true, value: 'Bestaande locatie',
    focus(options) { calls.push(['focus', options]); },
    setSelectionRange(start, end) { calls.push(['caret', start, end]); }
  };
  assert.equal(focusTextField(input), true);
  assert.deepEqual(calls, [
    ['focus', { preventScroll: true }],
    ['caret', input.value.length, input.value.length]
  ]);
});

test('text focus ignores unavailable fields and tolerates unsupported selection', () => {
  assert.equal(focusTextField(null), false);
  assert.equal(focusTextField({ isConnected: false }), false);
  assert.equal(focusTextField({ isConnected: true, disabled: true }), false);
  let focusCount = 0;
  const input = {
    isConnected: true,
    value: '52',
    focus() { focusCount += 1; },
    setSelectionRange() { throw new DOMException('Not supported', 'InvalidStateError'); }
  };
  assert.equal(focusTextField(input), true);
  assert.equal(focusCount, 1);
});

test('location editor, onboarding and other-place search all focus text inputs', async () => {
  const read = name => readFile(new URL(name, import.meta.url), 'utf8');
  const [guided, locations, intro, story] = await Promise.all([
    read('../src/ui/LocationOnboardingFlow.js'),
    read('../src/ui/LocationsView.js'),
    read('../src/ui/Boot.js'),
    read('../src/ui/Story.js')
  ]);
  assert.match(guided, /focusTextField\(form\.elements\.address\)/);
  assert.match(guided, /focusTextField\(form\.elements\.triggerMessage\)/);
  assert.match(locations, /isNew, editMode, useGps, location, geocoder/);
  assert.match(intro, /focusTextField\(input\)/);
  assert.match(story, /focusTextField\(form\.querySelector\('input\[name="query"\]'\)\)/);
});
