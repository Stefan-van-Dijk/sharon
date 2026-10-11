import {sanitizeEnvironmentAppearance} from './EnvironmentAppearance.js?v=0.1.89';
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
 }}}
]);
const validIndex=i=>Number.isInteger(i)&&i>=0&&i<STYLE_SCENARIOS.length;
// Existing v1 appearance remains authoritative for the active slot.
export function createEnvironmentScenarioDeck(activeStyle={},saved=null){
 const active=validIndex(saved?.active)?saved.active:0;
 const slots=STYLE_SCENARIOS.map((scene,i)=>
   sanitizeEnvironmentAppearance(saved?.slots?.[i]??scene.defaults));
 slots[active]=sanitizeEnvironmentAppearance(activeStyle);
 return {active,slots};
}
export function saveEnvironmentScenario(deck,appearance){
 const slots=[...deck.slots];
 slots[deck.active]=sanitizeEnvironmentAppearance(appearance);
 return {active:deck.active,slots};
}
export function changeEnvironmentScenario(deck,direction){
 if(!Number.isInteger(direction))return deck;
 const n=STYLE_SCENARIOS.length;
 return {active:((deck.active+direction)%n+n)%n,slots:deck.slots};
}
