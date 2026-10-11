import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEIGHT_TARGETS, MAX_HEIGHT_CUTS, sanitizeHeightBands, addHeightCut,
  moveHeightCut, removeHeightCut, editHeightBand, heightBandLabel,
  buildBuildingBandExpression, buildLandReliefExpression
} from '../src/ui/EnvironmentHeight.js';
import {
  sanitizeEnvironmentAppearance, resolvedEnvironmentAppearance,
  applyEnvironmentAppearance
} from '../src/ui/EnvironmentAppearance.js';
import { environmentStyle } from '../src/ui/EnvironmentStyle.js';

test('no height boundaries by default: land and buildings have one unsplit appearance', () => {
  assert.deepEqual(sanitizeHeightBands(undefined), {});
  assert.equal(HEIGHT_TARGETS.buildings.suggested, 20);
  assert.equal(HEIGHT_TARGETS.land.suggested, 25);
  assert.deepEqual(sanitizeEnvironmentAppearance({}), {});
  assert.equal(buildBuildingBandExpression(undefined, 'fill', '#ffffff', () => '#000000'),
    '#ffffff');
  assert.equal(buildLandReliefExpression(undefined, '#ffffff', () => '#000000'), null);
});

test('user can add six sorted height boundaries, move one with a slider and merge it away', () => {
  let settings = {};
  settings = addHeightCut(settings, 'buildings', 20);
  assert.deepEqual(settings.buildings.cuts, [20]);
  assert.deepEqual(settings.buildings.styles, [{}, {}]);
  settings = editHeightBand(settings, 'buildings', 1, 'fill', '#abcdee');
  settings = addHeightCut(settings, 'buildings', 8);
  assert.deepEqual(settings.buildings.cuts, [8,20]);
  assert.deepEqual(settings.buildings.styles, [{},{},{fill:'#abcdee'}]);
  settings = moveHeightCut(settings, 'buildings', 1, 25);
  assert.deepEqual(settings.buildings.cuts, [8,25]);
  assert.deepEqual(moveHeightCut(settings, 'buildings', 1, 6), settings);
  assert.deepEqual(addHeightCut(settings, 'buildings', 25), settings);
  assert.equal(heightBandLabel(settings, 'buildings', 1), '8 m – 25 m');
  settings = removeHeightCut(settings, 'buildings', 0);
  assert.deepEqual(settings.buildings.cuts, [25]);
  settings = removeHeightCut(settings, 'buildings', 0);
  assert.deepEqual(settings, {});
  for (const v of [20,40,60,80,100,120,140,160])
    settings = addHeightCut(settings, 'buildings', v);
  assert.equal(settings.buildings.cuts.length, MAX_HEIGHT_CUTS);
});

test('malicious or invalid height settings are discarded, while per-class overrides inherit', () => {
  const clean = sanitizeEnvironmentAppearance({
    heightBands: {
      land: { cuts: [-25,25,25,Infinity,9000,1], styles: [
        {fill:'#aabbcc'}, {fill:'#abcdef'}, {fill:'#123456'}, {fill:'url(hack)'}
      ] },
      buildings: { cuts: [20,80], styles: [
        {fill:'#a1b2c3', stroke:'#223344',hatch:'fine',dash:'dotted'},
        {fill:'#d4e5f6', stroke:'#123456',hatch:'invalid'},
        {hatch:'none'}
      ] },
      invented: {cuts:[10], styles:[]}
    },
    groupStyles: {basis:{fill:'#eeeeee'}}
  });
  assert.deepEqual(clean.heightBands.land.cuts, [-25,25]);
  assert.equal(clean.heightBands.land.styles[0].fill, '#aabbcc');
  assert.deepEqual(clean.heightBands.buildings.styles[0],
    {fill:'#a1b2c3',stroke:'#223344',hatch:'fine'});
  assert.equal(clean.heightBands.buildings.styles[2].hatch, 'none');
  assert.equal(resolvedEnvironmentAppearance(clean,'land').fill, '#eeeeee');
  assert.equal(sanitizeEnvironmentAppearance(clean).heightBands.buildings.cuts.length,2);
});

test('buildings use actual render_height and preserve native styling for missing heights', () => {
  const band = addHeightCut({}, 'buildings', 20).buildings;
  band.styles[0] = {fill:'#abcdef'};
  band.styles[1] = {fill:'#123456'};
  const expression = buildBuildingBandExpression(band,'fill','#dddddd',style=>style.fill || '#dddddd');
  assert.deepEqual(expression, ['case', ['has','render_height'],
    ['step', ['to-number', ['get','render_height'], -1], '#abcdef',20,'#123456'],
    '#dddddd']);
});

test('land bands create precise DEM color stops with no implicit split', () => {
  const band = addHeightCut(addHeightCut({}, 'land', 0), 'land', 100).land;
  band.styles[0] = {fill:'#111111'};
  band.styles[1] = {fill:'#888888'};
  band.styles[2] = {fill:'#eeeeee'};
  const expression = buildLandReliefExpression(band,'#ffffff',style=>style.fill || '#ffffff');
  assert.equal(expression[0], 'interpolate');
  assert.deepEqual(expression.slice(1,3), [['linear'],['elevation']]);
  assert.deepEqual(expression.slice(3,9), [-12000,'#111111',-.01,'#111111',0,'#888888']);
  assert.equal(expression.at(-1), '#eeeeee');
});

test('DEM source is lazily loaded for land only after a user adds at least one cut', () => {
  const all = new Map(environmentStyle.layers.map(layer=>[layer.id,layer]));
  const layers = new Map(all), sources = new Map();
  const paints=[];
  const map = {
    getLayer: id => layers.get(id),
    getSource: id => sources.get(id),
    addSource: (id,entry) => sources.set(id,entry),
    removeSource: id => sources.delete(id),
    addLayer: (layer,before) => {assert.equal(before,'forest');layers.set(layer.id,layer)},
    removeLayer: id => layers.delete(id),
    setPaintProperty: (id,key,value) => paints.push({id,key,value})
  };
  applyEnvironmentAppearance(map, {});
  assert.equal(sources.size, 0);
  assert.equal(layers.has('sharon-height-relief'),false);
  const bands = addHeightCut({}, 'land',25);
  applyEnvironmentAppearance(map, {heightBands:bands}, 'land');
  assert.equal(sources.get('sharon-height-dem').encoding,'terrarium');
  assert.equal(sources.get('sharon-height-dem').tileSize,512);
  assert.equal(layers.get('sharon-height-relief').type,'color-relief');
  applyEnvironmentAppearance(map, {heightBands:addHeightCut(bands,'land',150)}, 'land');
  assert.ok(paints.some(p=>p.id==='sharon-height-relief'&&p.key==='color-relief-color'));
  applyEnvironmentAppearance(map, {}, 'land');
  assert.equal(sources.size,0);
  assert.equal(layers.has('sharon-height-relief'),false);
});

test('building-height color classes do not affect the ordinary building layer defaults', () => {
  const byId = new Map(environmentStyle.layers.map(l=>[l.id,l]));
  const calls=[];
  const map={getLayer:id=>byId.get(id),setPaintProperty:(id,k,v)=>calls.push([id,k,v])};
  const band = editHeightBand(addHeightCut({},'buildings',20),'buildings',1,'fill','#000099');
  applyEnvironmentAppearance(map,{heightBands:band},'buildings');
  const color = calls.find(c=>c[0]==='building'&&c[1]==='fill-color')[2];
  assert.equal(color[0],'case');
  assert.ok(JSON.stringify(color).includes('render_height'));
  assert.ok(JSON.stringify(color).includes('#000099'));
  assert.ok(calls.some(c=>c[0]==='building-outline'&&c[1]==='line-color'));
});

test('height editor keeps new height subdivisions in an overlay, independent from scale zoom', async () => {
  const {readFile}=await import('node:fs/promises');
  const [editor,html] = await Promise.all([
    readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.ok(editor.includes('data-height-open'));
  assert.ok(editor.includes('data-height-slider'));
  assert.ok(editor.includes('data-height-add'));
  assert.ok(editor.includes('data-height-bands'));
  assert.ok(editor.includes('Grens toevoegen'));
  assert.ok(editor.includes('Grens verplaatsen'));
  assert.ok(editor.includes("heightPicker.hidden = true"));
  assert.ok(editor.includes("editHeightBand("));
  assert.ok(html.includes('.environment-height-picker'));
  assert.ok(html.includes('position:absolute;z-index:11;left:0;right:0;bottom:82px'));
  assert.ok(html.includes('grid-template-rows:35px 29px 54px 44px 30px 43px 69px'));
});
