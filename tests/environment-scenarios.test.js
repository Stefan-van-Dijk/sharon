import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ENVIRONMENT_SCENARIOS_KEY, STYLE_SCENARIOS, createEnvironmentScenarioDeck,
 saveEnvironmentScenario, changeEnvironmentScenario,
 DEFAULT_SCENARIO_INDEX, isStandardScenario,
 serializeEnvironmentStyle, parseEnvironmentStyle, STYLE_EXPORT_FORMAT, MAX_STYLE_FILE_BYTES
} from '../src/ui/EnvironmentScenarios.js';
import {readFile} from 'node:fs/promises';

test('existing local style migrates intact to Eigen and other presets are distinct',()=>{
 const prior={land:{fill:'#223344'},groupStyles:{roads:{stroke:'#667788',width:2}}};
 const deck=createEnvironmentScenarioDeck(prior);
 assert.equal(ENVIRONMENT_SCENARIOS_KEY,'environment-style-scenarios:v1');
 assert.deepEqual(STYLE_SCENARIOS.map(s=>s.label),['Eigen','Rustig','Contrast','Monochroom','Futuristisch','Oude kaart','Blauwdruk','Nacht','Standaard']);
 assert.equal(deck.active,0);
 assert.deepEqual(deck.slots[0],prior);
 assert.equal(deck.slots[1].groupStyles.roads.width,0.75);
 assert.equal(deck.slots[2].groupStyles.roads.width,1.75);
 assert.equal(deck.slots[3].groupStyles.roads.stroke,'#555555');
 assert.equal(deck.slots[4].groupStyles.roads.stroke,'#48e0ec');
 assert.equal(deck.slots[5].groupStyles.basis.fill,'#e8d3aa');
 assert.deepEqual(deck.slots[DEFAULT_SCENARIO_INDEX],{});
 assert.equal(isStandardScenario(deck),false);
});
test('scenario swiping and independent edits persist across reloads',()=>{
 const original=createEnvironmentScenarioDeck({land:{fill:'#123456'}});
 const other=changeEnvironmentScenario(original,1);
 const edited=saveEnvironmentScenario(other,{land:{fill:'#aabbcc'}});
 assert.deepEqual(edited.slots[0],{land:{fill:'#123456'}});
 assert.deepEqual(edited.slots[1],{land:{fill:'#aabbcc'}});
 const restored=createEnvironmentScenarioDeck({land:{fill:'#aabbcc'}},edited);
 assert.equal(restored.active,1);
 assert.deepEqual(restored.slots[1],{land:{fill:'#aabbcc'}});
 assert.deepEqual(changeEnvironmentScenario(restored,-1).slots[0],original.slots[0]);
 assert.equal(changeEnvironmentScenario(restored,-2).active,STYLE_SCENARIOS.length-1);
 assert.equal(changeEnvironmentScenario(restored,STYLE_SCENARIOS.length).active,1);
});
test('invalid persisted scenario data is safely sanitized',()=>{
 const restored=createEnvironmentScenarioDeck({land:{fill:'#ffffff'}},{
   active:999,slots:[null,{roads:{width:100}},{water:{fill:'not-a-color'}}]
 });
 assert.equal(restored.active,0);
 assert.deepEqual(restored.slots[DEFAULT_SCENARIO_INDEX],{});
 assert.deepEqual(restored.slots[0],{land:{fill:'#ffffff'}});
 assert.ok(!restored.slots[1].roads);
 assert.ok(!restored.slots[2].water);
});
test('swipe gestures, handle, centering, attribution and service-worker asset are present',async()=>{
 const [map,editor,css,sw]=await Promise.all([
 readFile(new URL('../src/ui/EnvironmentMapLibre.js',import.meta.url),'utf8'),
 readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js',import.meta.url),'utf8'),
 readFile(new URL('../index.html',import.meta.url),'utf8'),
 readFile(new URL('../service-worker.js',import.meta.url),'utf8')
 ]);
 for(const key of ['data-style-scenarios','data-style-scenario-prev','data-style-scenario-next'])
   assert.ok(map.includes(key));
 for(const snippet of ["listen(scenarioBar, 'touchstart'","listen(scenarioBar, 'touchend'",
   "listen(dismissHandle,'touchstart'","listen(dismissHandle,'touchmove'",
   "if(dy>=65)setStyleMode(false)","host.style.translate"])
   assert.ok(editor.includes(snippet),snippet);
 assert.ok(editor.includes('selectScenario(dx<0?1:-1)'));
 assert.ok(css.includes('.environment-style-dismiss-handle{'));
 assert.ok(css.includes('.environment-scenario-switcher{'));
 assert.ok(css.includes('grid-template-columns:44px minmax(0,max-content) 44px'));
 assert.ok(css.includes('left:50%;right:auto;bottom:max(12px,env(safe-area-inset-bottom));'));
 assert.ok(css.includes('.app-stage.is-environment .environment-style-flyout{'));
 assert.ok(css.includes('.environment-style-flyout{transition:none!important}'));
 assert.ok(css.includes('.app-stage.is-environment.is-map-clean .environment-maplibre .maplibregl-ctrl-bottom-right{'));
 assert.ok(sw.includes("EnvironmentScenarios.js?v=0.1.93"));
});

test('Standaard remains native map style and cannot be overwritten',()=>{
 const standard=changeEnvironmentScenario(createEnvironmentScenarioDeck({}),-1);
 assert.equal(isStandardScenario(standard),true);
 assert.deepEqual(standard.slots[DEFAULT_SCENARIO_INDEX],{});
 const saved=saveEnvironmentScenario(standard,{land:{fill:'#123456'}});
 assert.deepEqual(saved.slots[DEFAULT_SCENARIO_INDEX],{});
 const loaded=createEnvironmentScenarioDeck({land:{fill:'#ffffff'}},{
   active:DEFAULT_SCENARIO_INDEX,slots:[{},null,null,null,null,null,null,null,{land:{fill:'#ff0000'}}]
 });
 assert.deepEqual(loaded.slots[DEFAULT_SCENARIO_INDEX],{});
});
test('export and import round-trip only permitted style properties',()=>{
 const input={land:{fill:'#987654',anything:'sensitive'},
   groupStyles:{roads:{width:1.5,stroke:'#abcdef'}},
   location:{latitude:52,longitude:5},user:{id:'private'}};
 const exported=serializeEnvironmentStyle('eigen',input);
 const payload=JSON.parse(exported);
 assert.equal(payload.format,STYLE_EXPORT_FORMAT);
 assert.equal(payload.version,1);
 assert.equal(payload.name,'Eigen');
 assert.ok(!exported.includes('sensitive'));
 assert.ok(!exported.includes('latitude'));
 assert.ok(!exported.includes('private'));
 const restored=parseEnvironmentStyle(exported);
 assert.deepEqual(restored,{land:{fill:'#987654'},
   groupStyles:{roads:{width:1.5,stroke:'#abcdef'}}});
 assert.throws(()=>serializeEnvironmentStyle('unknown',{}));
});
test('import rejects invalid, oversized or unsupported files',()=>{
 for(const data of ['garbage','{}','[]',
   JSON.stringify({format:STYLE_EXPORT_FORMAT,version:2,appearance:{}}),
   JSON.stringify({format:STYLE_EXPORT_FORMAT,version:1,appearance:[]}),
   'x'.repeat(MAX_STYLE_FILE_BYTES+1)])
  assert.throws(()=>parseEnvironmentStyle(data));
});

test('stylebar offers import/export instead of both reset controls and provides 10px visual credit gap',async()=>{
 const [map,editor,css]=await Promise.all([
  readFile(new URL('../src/ui/EnvironmentMapLibre.js',import.meta.url),'utf8'),
  readFile(new URL('../src/ui/EnvironmentAppearanceEditor.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8')
 ]);
 for(const marker of ['data-style-export','data-style-import','data-style-import-file'])
   assert.ok(map.includes(marker));
 assert.ok(!map.includes('data-style-reset-one'));
 assert.ok(!map.includes('data-style-reset-all'));
 assert.ok(editor.includes("listen(exportButton,'click'"));
 assert.ok(editor.includes("listen(importButton,'click'"));
 assert.ok(editor.includes("listen(importFile,'change'"));
 assert.ok(editor.includes("parseEnvironmentStyle(await file.text())"));
 assert.ok(editor.includes("serializeEnvironmentStyle(selected.id,overrides)"));
 assert.ok(css.includes('bottom:calc(max(12px,env(safe-area-inset-bottom)) + 79px);'));
 assert.ok(!css.includes('bottom:calc(max(12px,env(safe-area-inset-bottom)) + 67px);'));
});
