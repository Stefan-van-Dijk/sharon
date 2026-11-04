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
  assert.equal(x.likedStyle,'red-border');
  assert.equal(x.readStyle,'transparent');
});
test('de kaart gebruikt wijzigingen meteen zonder bron opnieuw te laden',async()=>{
  const visible=new Set(['sharon-chain-points','sharon-chain-points-icons','sharon-chain-points-names','sharon-wikipedia-points','sharon-wikipedia-icons','sharon-wikipedia-names','sharon-object-point-labels','sharon-points']);
  const actions=[];
  const map={
    getLayer:id=>visible.has(id)?{id}:null,
    setLayoutProperty:(...args)=>actions.push(['layout',...args]),
    setPaintProperty:(...args)=>actions.push(['paint',...args]),
    getSource:id=>({getClusterOptions:()=>({cluster:true}),getData:async()=>({type:'FeatureCollection',features:[]}),setClusterOptions:async opts=>actions.push(['cluster',id,opts]),setData:async()=>actions.push(['reload',id])})
  };
  await applyMapDisplay(map,{showNames:false,showIcons:false,showPoints:false,clusterPoints:false,pointSize:8,iconSize:28,nameSize:16});
  assert.ok(actions.some(a=>a[0]==='layout'&&a[1]==='sharon-chain-points-icons'&&a[2]==='visibility'&&a[3]==='none'));
  assert.ok(actions.some(a=>a[0]==='layout'&&a[1]==='sharon-wikipedia-names'&&a[2]==='visibility'&&a[3]==='none'));
  assert.ok(actions.some(a=>a[0]==='paint'&&a[1]==='sharon-points'&&a[2]==='circle-radius'&&a[3]===8));
  assert.ok(actions.some(a=>a[0]==='cluster'&&a[2].cluster===false));
});

test('compacte weergave bewaart vier onafhankelijke schakelaars en de gezamenlijke grootte',()=>{
  const state=normalizeMapDisplay({showIcons:false,showNames:true,showPoints:false,clusterPoints:true,iconSize:28,pointSize:7,nameSize:16});
  assert.equal(state.showIcons,false);
  assert.equal(state.showPoints,false);
  assert.equal(state.showNames,true);
  assert.equal(state.clusterPoints,true);
  assert.equal(state.iconSize/4,state.pointSize);
  assert.equal(state.nameSize,16);
});

test('oude statuskeuzes migreren naar transparant gelezen en rode rand',()=>{
  const state=normalizeMapDisplay({readStyle:'check',likedStyle:'heart'});
  assert.equal(state.readStyle,'transparent');
  assert.equal(state.likedStyle,'red-border');
});

test('bundelen schakelt uit en weer aan, met dezelfde GeoJSON-objecten',async()=>{
  const data={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'winkel'},geometry:{type:'Point',coordinates:[5,52]}}]};
  let cluster=true;
  const actions=[];
  const source={
    getClusterOptions:()=>({cluster}),
    getData:async()=>data,
    setClusterOptions:async({cluster:enabled})=>{cluster=enabled;actions.push(['toggle',enabled]);},
    setData:async value=>{assert.equal(value,data);actions.push(['reload',cluster]);}
  };
  const map={getSource:id=>id==='sharon-chain-branches'?source:null,getLayer:()=>null};
  await applyMapDisplay(map,{clusterPoints:false});
  await applyMapDisplay(map,{clusterPoints:true});
  assert.deepEqual(actions,[['toggle',false],['reload',false],['toggle',true],['reload',true]]);
});

test('snelle wijzigingen in bundelen worden in volgorde uitgevoerd',async()=>{
  const data={type:'FeatureCollection',features:[]};
  let cluster=true;
  const changes=[];
  const source={getClusterOptions:()=>({cluster}),getData:async()=>data,
    setClusterOptions:async({cluster:v})=>{cluster=v;changes.push(v);},setData:async()=>{}};
  const map={getSource:id=>id==='sharon-chain-branches'?source:null,getLayer:()=>null};
  await Promise.all([applyMapDisplay(map,{clusterPoints:false}),applyMapDisplay(map,{clusterPoints:true})]);
  assert.deepEqual(changes,[false,true]);
  assert.equal(cluster,true);
});

test('rotation toggles independently of pinch zoom and resets north',()=>{
  let bearing=37, drag=true, rotation=true;
  const map={getBearing:()=>bearing,setBearing:value=>bearing=value,
    dragRotate:{enable(){drag=true;},disable(){drag=false;}},
    touchZoomRotate:{enableRotation(){rotation=true;},disableRotation(){rotation=false;},
      disable(){assert.fail('Pinch zoom must remain enabled');}},getLayer:()=>null,getSource:()=>null};
  applyMapDisplay(map,{});
  assert.deepEqual([bearing,drag,rotation],[0,false,false]);
  applyMapDisplay(map,{allowRotation:true});
  assert.deepEqual([drag,rotation],[true,true]);
  bearing=90;applyMapDisplay(map,{allowRotation:false});
  assert.deepEqual([bearing,drag,rotation],[0,false,false]);
});
