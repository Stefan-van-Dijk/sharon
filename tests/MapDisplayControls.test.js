import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_DISPLAY_DEFAULTS,normalizeMapDisplay,applyMapDisplay } from '../src/ui/MapDisplayControls.js';

test('kaartinstellingen hebben veilige standaardwaarden en begrensde formaten',()=>{
  assert.deepEqual(normalizeMapDisplay(),MAP_DISPLAY_DEFAULTS);
  const x=normalizeMapDisplay({showNames:false,iconSize:900,pointSize:-7,nameSize:14,likedStyle:'unsafe'});
  assert.equal(x.showNames,false);
  assert.equal(x.iconSize,32);
  assert.equal(x.pointSize,2);
  assert.equal(x.nameSize,14);
  assert.equal(x.likedStyle,'heart');
});
test('de kaart gebruikt wijzigingen meteen zonder bron opnieuw te laden',()=>{
  const visible=new Set(['sharon-chain-points','sharon-chain-points-icons','sharon-chain-points-names','sharon-wikipedia-points','sharon-wikipedia-icons','sharon-wikipedia-names','sharon-object-point-labels','sharon-points']);
  const actions=[];
  const map={
    getLayer:id=>visible.has(id)?{id}:null,
    setLayoutProperty:(...args)=>actions.push(['layout',...args]),
    setPaintProperty:(...args)=>actions.push(['paint',...args]),
    getSource:id=>({setClusterOptions:opts=>actions.push(['cluster',id,opts])})
  };
  applyMapDisplay(map,{showNames:false,showIcons:false,showPoints:false,clusterPoints:false,pointSize:8,iconSize:28,nameSize:16});
  assert.ok(actions.some(a=>a[0]==='layout'&&a[1]==='sharon-chain-points-icons'&&a[2]==='visibility'&&a[3]==='none'));
  assert.ok(actions.some(a=>a[0]==='layout'&&a[1]==='sharon-wikipedia-names'&&a[2]==='visibility'&&a[3]==='none'));
  assert.ok(actions.some(a=>a[0]==='paint'&&a[1]==='sharon-points'&&a[2]==='circle-radius'&&a[3]===8));
  assert.ok(actions.some(a=>a[0]==='cluster'&&a[2].cluster===false));
});
