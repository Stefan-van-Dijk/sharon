import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const spec=path=>'./src/'+path+'?v='+version;
function fakeMap(){
 let center={lat:48.857,lng:2.35};const sources=new Map(),layers=new Map(),handlers=new Map();
 return {sources,move(point){center=point;for(const fn of handlers.get('moveend')||[])fn();},
  getCenter:()=>({...center}),getZoom:()=>15,isStyleLoaded:()=>true,
  getBounds:()=>({getWest:()=>center.lng-.005,getEast:()=>center.lng+.005,getSouth:()=>center.lat-.005,getNorth:()=>center.lat+.005}),
  addSource(id,options){sources.set(id,{data:options.data,setData(data){this.data=data;}});},getSource:id=>sources.get(id),
  addLayer(layer){layers.set(layer.id,layer);},getLayer:id=>layers.get(id),setFilter(){},setPaintProperty(){},getCanvas:()=>({style:{}}),
  on(name,...args){if(typeof args.at(-1)!=='function')return;if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(args.at(-1));},
  off(name,...args){handlers.get(name)?.delete(args.at(-1));},easeTo(){},queryRenderedFeatures:()=>[]};
}
const turn=()=>new Promise(resolve=>setTimeout(resolve,40));
test('shop points survive panning and remounting; disabling resets discovered points and coverage',async()=>{
 const app=await appHarness();let layer;
 try{
  const map=fakeMap(),calls=[];const v='v1-'+'a'.repeat(24);
  app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);calls.push(q);return {ok:true,json:async()=>q.action==='catalog'?{schema:1,version:v,chains:[]}:{schema:1,version:v,coverage:'WORLD',points:[q.bounds[0]<3?['paris0000001','',2350000,48857000,'Paris shop','node/1']:['berlin000001','',13400000,52500000,'Berlin shop','node/2']],truncated:false}};};
  const {mountChainLayer}=await app.load(spec('ui/ChainLayer.js'));
  const root=app.document.createElement('div');root.innerHTML='<button data-chain-toggle></button><select data-chain-filter></select><small data-chain-status></small>';app.document.body.append(root);
  const open=()=>{const l=mountChainLayer(map,{}, {root,store:app.store});root.querySelector('[data-chain-toggle]').click();return l;};
  layer=open();await until(()=>layer.getBoards().length===1);
  map.move({lat:52.5,lng:13.4});await until(()=>layer.getBoards().some(p=>p.name==='Berlin shop'));
  assert.equal(map.sources.get('sharon-chain-branches').data.features.length,2,'both cities remain in the render source');
  assert.equal(layer.getBoards().length,1,'board list stays inside the visible area');
  const before=calls.filter(q=>q.action==='map').length;
  map.move({lat:48.857,lng:2.351});assert.equal(layer.getBoards()[0].name,'Paris shop');await turn();
  assert.equal(calls.filter(q=>q.action==='map').length,before,'slightly different camera is covered by the visited area');
  layer.destroy();layer=open();await until(()=>layer.getBoards().length===1);await turn();assert.equal(calls.filter(q=>q.action==='map').length,before);
  const savedBefore=JSON.stringify(await app.store.getAll('objects'));
  root.querySelector('[data-chain-toggle]').click();assert.equal(layer.getBoards().length,0);assert.equal(map.sources.get('sharon-chain-branches').data.features.length,0);
  root.querySelector('[data-chain-toggle]').click();await until(()=>calls.filter(q=>q.action==='map').length===before+1);await until(()=>layer.getBoards().length===1);
  assert.equal(map.sources.get('sharon-chain-branches').data.features.length,1,'Berlin was discarded by the reset');
  assert.equal(JSON.stringify(await app.store.getAll('objects')),savedBefore,'saved locations are preserved');
 }finally{layer?.destroy();app.close();}
});
test('Wikipedia retains visited areas while enabled and resets discovery when disabled',async()=>{
 const app=await appHarness();let layer;
 try{
  const map=fakeMap();let calls=0;
  app.window.fetch=async url=>{calls++;const query=new URL(url).searchParams;const paris=Number(query.get('ggscoord').split('|')[1])<3;return {ok:true,json:async()=>({query:{pages:{1:{pageid:paris?1:2,title:paris?'Paris tower':'Berlin tower',pageprops:{wikibase_item:paris?'Q1':'Q2'},coordinates:[{lat:paris?48.857:52.5,lon:paris?2.35:13.4}]}}}})};};
  const {mountWikipediaLayer}=await app.load(spec('ui/WikipediaLayer.js'));
  layer=mountWikipediaLayer(map,{});layer.setEnabled(true);await until(()=>layer.getBoards().length===1);
  map.move({lat:52.5,lng:13.4});await until(()=>layer.getBoards()[0]?.properties.title==='Berlin tower');
  assert.equal(map.sources.get('sharon-wikipedia').data.features.length,2);assert.equal(layer.getBoards().length,1);
  map.move({lat:48.857,lng:2.351});await turn();assert.equal(calls,2);assert.equal(layer.getBoards()[0].properties.title,'Paris tower');
  layer.setEnabled(false);assert.equal(map.sources.get('sharon-wikipedia').data.features.length,0);
  layer.setEnabled(true);await until(()=>calls===3);await until(()=>layer.getBoards().length===1);assert.equal(map.sources.get('sharon-wikipedia').data.features.length,1);
  layer.destroy();layer=mountWikipediaLayer(map,{});layer.setEnabled(true);await turn();assert.equal(calls,3);assert.equal(layer.getBoards()[0].properties.title,'Paris tower');
 }finally{layer?.destroy();app.close();}
});
