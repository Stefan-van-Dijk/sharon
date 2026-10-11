import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ENVIRONMENT_SCENARIOS_KEY, STYLE_SCENARIOS, createEnvironmentScenarioDeck,
 saveEnvironmentScenario, changeEnvironmentScenario
} from '../src/ui/EnvironmentScenarios.js';
import {readFile} from 'node:fs/promises';

test('existing local style migrates intact to Eigen and other presets are distinct',()=>{
 const prior={land:{fill:'#223344'},groupStyles:{roads:{stroke:'#667788',width:2}}};
 const deck=createEnvironmentScenarioDeck(prior);
 assert.equal(ENVIRONMENT_SCENARIOS_KEY,'environment-style-scenarios:v1');
 assert.deepEqual(STYLE_SCENARIOS.map(s=>s.label),['Eigen','Rustig','Contrast','Monochroom']);
 assert.equal(deck.active,0);
 assert.deepEqual(deck.slots[0],prior);
 assert.equal(deck.slots[1].groupStyles.roads.width,0.75);
 assert.equal(deck.slots[2].groupStyles.roads.width,1.75);
 assert.equal(deck.slots[3].groupStyles.roads.stroke,'#555555');
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
 assert.equal(changeEnvironmentScenario(restored,-2).active,3);
 assert.equal(changeEnvironmentScenario(restored,4).active,1);
});
test('invalid persisted scenario data is safely sanitized',()=>{
 const restored=createEnvironmentScenarioDeck({land:{fill:'#ffffff'}},{
   active:999,slots:[null,{roads:{width:100}},{water:{fill:'not-a-color'}}]
 });
 assert.equal(restored.active,0);
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
 assert.ok(sw.includes("EnvironmentScenarios.js?v=0.1.89"));
});
