import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';
import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, appearanceSectionFor,
  resolvedEnvironmentAppearance, sanitizeEnvironmentAppearance, applyEnvironmentAppearance
} from '../src/ui/EnvironmentAppearance.js';
import { environmentHatchPreview } from '../src/ui/EnvironmentHatch.js';

test('Objecten shows only source-backed types, with horizontal scrolling', () => {
  const section = APPEARANCE_SECTIONS.find(item => item.id === 'structures');
  assert.equal(section.label, 'Objecten');
  assert.deepEqual(section.items, [
    'bridges','tunnels','piers','dams','fords'
  ]);
  assert.equal(appearanceSectionFor('piers').id, 'structures');
  assert.equal(APPEARANCE_SECTIONS.find(item => item.id === 'transport').items.includes('piers'), false);
  assert.equal(section.items.length, 5);
  const byId = new Map(APPEARANCE_GROUPS.map(item => [item.id,item]));
  for (const id of section.items) {
    const item = byId.get(id);
    assert.ok(item, 'missing real object group: ' + id);
    assert.ok(item.fill || item.lines?.length, 'no source-backed layers for ' + id);
  }
  for (const name of ['pumpingStations','locks','weirs']) {
    assert.ok(!byId.has(name), 'unsupported type should not be offered: ' + name);
  }
});

test('bridges, tunnels, and fords map directly to OpenMapTiles transportation brunnel attribute', () => {
  const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
  for (const [id, brunnel] of [
    ['structure_bridge','bridge'],['structure_tunnel','tunnel'],['structure_ford','ford']
  ]) {
    const layer = layers.get(id);
    assert.ok(layer, id);
    assert.equal(layer.type,'line');
    assert.equal(layer.source,'openmaptiles');
    assert.equal(layer['source-layer'],'transportation');
    assert.ok(JSON.stringify(layer.filter).includes('"brunnel"'));
    assert.ok(JSON.stringify(layer.filter).includes('"'+brunnel+'"'));
    assert.ok(layer.paint['line-width'] > 0);
    assert.ok(layer.minzoom >= 9);
  }
  const dam=layers.get('structure_dam');
  assert.equal(dam.type,'fill');
  assert.equal(dam['source-layer'],'landuse');
  assert.deepEqual(dam.filter,['==',['get','class'],'dam']);
  assert.equal(layers.get('structure_dam-outline').type,'line');
  assert.equal(layers.get('structure_dam-hatch').type,'fill');
});

test('saved choices for existing objects remain unchanged when piers move to Kunstwerken', () => {
  const saved = sanitizeEnvironmentAppearance({
    piers:{stroke:'#123456',width:2},
    groupStyles:{structures:{stroke:'#556677',width:3}},
    bridges:{stroke:'#aabbcc',dash:'dotted'},
    pumpingStations:{stroke:'#ffffff'}
  });
  assert.deepEqual(saved.piers,{stroke:'#123456',width:2});
  assert.equal(saved.bridges.stroke,'#aabbcc');
  assert.equal(saved.groupStyles.structures.stroke,'#556677');
  assert.equal(saved.pumpingStations,undefined);
  assert.equal(resolvedEnvironmentAppearance(saved,'tunnels').stroke,'#556677');
  assert.equal(resolvedEnvironmentAppearance(saved,'piers').stroke,'#123456');
  const all = new Map(environmentStyle.layers.map(layer=>[layer.id,layer]));
  const calls=[];
  applyEnvironmentAppearance({
    getLayer:id=>all.get(id),
    setPaintProperty:(id,key,value)=>calls.push([id,key,value])
  },saved,'group:structures');
  assert.ok(calls.some(x=>x[0]==='structure_tunnel'&&x[1]==='line-color'&&x[2]==='#556677'));
  assert.ok(calls.some(x=>x[0]==='road_pier'&&x[1]==='line-color'&&x[2]==='#123456'));
  assert.ok(calls.some(x=>x[0]==='structure_bridge'&&x[1]==='line-color'&&x[2]==='#aabbcc'));
});

test('only show hatch-color when an actual pattern is active; preserve saved pigment', async () => {
  const {readFile}=await import('node:fs/promises');
  const editor=await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js',import.meta.url),'utf8');
  assert.ok(editor.includes("values.hatch !== 'none'"));
  assert.ok(editor.includes("hatchColorRow.hidden = !showHatchColor"));
  assert.ok(editor.includes("hatchColorInput.disabled = !showHatchColor"));
  assert.ok(editor.includes("Number(showHatchColor)"));
  const saved=sanitizeEnvironmentAppearance({land:{hatch:'none',hatchColor:'#aa7733'}});
  assert.equal(resolvedEnvironmentAppearance(saved,'land').hatchColor,'#aa7733');
  assert.equal(resolvedEnvironmentAppearance(saved,'land').hatch,'none');
});

test('hatch symbol fills the whole button, without nested dashed box', async () => {
  const {readFile}=await import('node:fs/promises');
  const css=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const preview=environmentHatchPreview('none','n');
  assert.ok(preview.includes('<rect width="64" height="30"'));
  assert.ok(preview.includes('M0 30L64 0'));
  assert.ok(!preview.includes('stroke-dasharray'));
  assert.ok(css.includes('display:block;width:100%;max-width:none;height:100%;overflow:hidden'));
  assert.ok(css.includes('padding:0;background:rgba(255,255,255,.68);overflow:hidden'));
  assert.ok(css.includes('.environment-style-group.is-source-unavailable'));
  const editor=await readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js',import.meta.url),'utf8');
  assert.ok(!editor.includes('is-source-unavailable'));
  assert.ok(!editor.includes('extra objectgegevens nodig'));
});
