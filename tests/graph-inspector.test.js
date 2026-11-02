import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoDataset} from '../src/core/skeleton/SkeletonCore.js';
import {graphConnections} from '../src/core/skeleton/GraphService.js';
const settings=readFileSync(new URL('../src/ui/SettingsView.js',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../src/ui/GraphInspector.js',import.meta.url),'utf8');
test('graph inspector is isolated to demo Settings, not an app module',()=>{
 assert.match(settings,/data-graph-settings[^>]*hidden/);
 assert.match(settings,/inspector.hidden=!enabled/);
 assert.match(inspector,/demoWorkspace\(store\)/);
 assert.doesNotMatch(inspector,/store\.getAll\('objects'\)/);
 assert.doesNotMatch(inspector,/store\.put\(/);
});
test('graph inspector reads named relationships in both directions',()=>{
 const graph=demoDataset();
 const c=graphConnections(graph,'DemoCard0001');
 assert.ok(c.some(x=>x.target.title==='Voorbeeldwinkel' && x.label==='is bruikbaar bij'));
 assert.ok(graphConnections(graph,'DemoPlace001').some(x=>x.label==='heeft kaart'));
});
