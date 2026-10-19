import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportHeight } from '../src/ui/Viewport.js';
test('gedeelde hoogte gebruikt het volledige venster en volgt toetsenbord en rotatie', () => {
  const doc={activeElement:{matches:()=>false}};
  const win={innerHeight:844,visualViewport:{height:780,offsetTop:0}};
  assert.equal(viewportHeight(win,doc),844);
  win.visualViewport={height:820,offsetTop:30};
  assert.equal(viewportHeight(win,doc),850);
  doc.activeElement.matches=()=>true;
  win.visualViewport={height:440,offsetTop:0};
  assert.equal(viewportHeight(win,doc),440);
  doc.activeElement.matches=()=>false;
  win.innerHeight=390; win.visualViewport={height:390,offsetTop:0};
  assert.equal(viewportHeight(win,doc),390);
  delete win.visualViewport;
  assert.equal(viewportHeight(win,doc),390);
});
