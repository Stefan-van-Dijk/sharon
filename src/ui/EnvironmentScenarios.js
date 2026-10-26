import {sanitizeEnvironmentAppearance} from './EnvironmentAppearance.js?v=0.4.11';
export const ENVIRONMENT_SCENARIOS_KEY='environment-style-scenarios:v1';
export const STYLE_SCENARIOS=Object.freeze([
 {id:'eigen',label:'Eigen',defaults:{}},
 {id:'rustig',label:'Rustig',defaults:{groupStyles:{
   basis:{fill:'#f3f2ef',stroke:'#c7c7c9'},
   water:{fill:'#dceaf2',stroke:'#b8cedb'},
   roads:{stroke:'#b9bdc2',width:0.75},
   green:{fill:'#dfe8dc',stroke:'#c6d7c5'},
   structures:{stroke:'#b5b6b9'}
 }}},
 {id:'contrast',label:'Contrast',defaults:{groupStyles:{
   basis:{fill:'#252c36',stroke:'#d0cbd0'},
   water:{fill:'#13527b',stroke:'#86b6d4'},
   roads:{stroke:'#f2b95f',width:1.75},
   green:{fill:'#24513d',stroke:'#95d19d'},
   structures:{stroke:'#f2cf7e'}
 }}},
 {id:'monochroom',label:'Monochroom',defaults:{groupStyles:{
   basis:{fill:'#ededed',stroke:'#444444'},
   water:{fill:'#c5c5c5',stroke:'#777777'},
   roads:{stroke:'#555555',width:1.25},
   green:{fill:'#d3d3d3',stroke:'#8a8a8a'},
   structures:{stroke:'#333333'}
 }}},
 {id:'futuristisch',label:'Futuristisch',defaults:{groupStyles:{
   basis:{fill:'#121b38',stroke:'#77aaff'},
   water:{fill:'#071e45',stroke:'#28d9f3'},
   roads:{stroke:'#48e0ec',width:1.5},
   transport:{stroke:'#e784ff',width:1.5},
   green:{fill:'#123b45',stroke:'#64ffcd'},
   structures:{stroke:'#ff83b3',width:1.5},
   coast:{fill:'#24475d',stroke:'#64d5ff'}
 }}},
 {id:'oudekaart',label:'Oude kaart',defaults:{groupStyles:{
   basis:{fill:'#e8d3aa',stroke:'#75543a'},
   water:{fill:'#a8bec1',stroke:'#6b8991'},
   roads:{stroke:'#a25b42',width:1.25},
   transport:{stroke:'#665746'},
   green:{fill:'#b0b88b',stroke:'#75835b'},
   coast:{fill:'#d7bd8a',stroke:'#aa8b5d'},
   structures:{stroke:'#785239'}
 }}},
 {id:'blauwdruk',label:'Blauwdruk',defaults:{groupStyles:{
   basis:{fill:'#152d55',stroke:'#a6dfff'},
   water:{fill:'#244e7a',stroke:'#bce7f8'},
   roads:{stroke:'#8bc7ef',width:1.25},
   transport:{stroke:'#cfedff'},
   green:{fill:'#234b6b',stroke:'#8fd6ea'},
   structures:{stroke:'#d8eaff'}
 }}},
 {id:'nacht',label:'Nacht',defaults:{groupStyles:{
   basis:{fill:'#252a2f',stroke:'#929ea5'},
   water:{fill:'#162d3b',stroke:'#42677b'},
   roads:{stroke:'#e9c47b',width:1.25},
   transport:{stroke:'#bed0d8'},
   green:{fill:'#273d32',stroke:'#5a826a'},
   structures:{stroke:'#b5b1a8'}
 }}},
 {id:'standaard',label:'Standaard',defaults:{}}

]);
const validIndex=i=>Number.isInteger(i)&&i>=0&&i<STYLE_SCENARIOS.length;
export const DEFAULT_SCENARIO_INDEX=STYLE_SCENARIOS.findIndex(scene=>scene.id==='standaard');
export const isStandardScenario=deck=>!!deck&&deck.active===DEFAULT_SCENARIO_INDEX;
export const STYLE_EXPORT_FORMAT='sharon-map-style';
export const MAX_STYLE_FILE_BYTES=128*1024;
// Existing v1 appearance remains authoritative for the active slot.
export function createEnvironmentScenarioDeck(activeStyle={},saved=null){
 const active=validIndex(saved?.active)?saved.active:0;
 const slots=STYLE_SCENARIOS.map((scene,i)=>
   sanitizeEnvironmentAppearance(saved?.slots?.[i]??scene.defaults));
 slots[active]=sanitizeEnvironmentAppearance(activeStyle);
 // Standaard always maps to the immutable native renderer style.
 slots[DEFAULT_SCENARIO_INDEX]={};
 return {active,slots};
}
export function saveEnvironmentScenario(deck,appearance){
 const slots=[...deck.slots];
 slots[deck.active]=isStandardScenario(deck)?{}:sanitizeEnvironmentAppearance(appearance);
 return {active:deck.active,slots};
}
export function changeEnvironmentScenario(deck,direction){
 if(!Number.isInteger(direction))return deck;
 const n=STYLE_SCENARIOS.length;
 return {active:((deck.active+direction)%n+n)%n,slots:deck.slots};
}

/** Export only the selected map appearance; never location or user metadata. */
export function serializeEnvironmentStyle(scenarioId,appearance){
 const scenario=STYLE_SCENARIOS.find(scene=>scene.id===scenarioId);
 if(!scenario)throw new TypeError('Onbekend stijlscenario');
 return JSON.stringify({
   format:STYLE_EXPORT_FORMAT,version:1,name:scenario.label,
   appearance:sanitizeEnvironmentAppearance(appearance)
 },null,2);
}
/** Parse externally supplied JSON without trusting its keys or values. */
export function parseEnvironmentStyle(json){
 if(typeof json!=='string'||json.length>MAX_STYLE_FILE_BYTES)
   throw new Error('Stijlbestand is te groot');
 let data;
 try{data=JSON.parse(json);}catch{throw new Error('Ongeldig JSON-bestand');}
 if(!data||Array.isArray(data)||data.format!==STYLE_EXPORT_FORMAT||
    data.version!==1||!data.appearance||typeof data.appearance!=='object'||
    Array.isArray(data.appearance))
   throw new Error('Geen ondersteund Sharon-stijlbestand');
 return sanitizeEnvironmentAppearance(data.appearance);
}
