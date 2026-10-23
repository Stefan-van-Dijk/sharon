// Wikidata identifiers verified against OSM's Name Suggestion Index.
export const CHAIN_CATALOG = Object.freeze([
  {id:'Q1653985',name:'Albert Heijn',brands:['Q1653985','Q78163765','Q77971185'],kind:'supermarket'},
  {id:'Q2262314',name:'Jumbo',brands:['Q2262314'],kind:'supermarket'},
  {id:'Q903805',name:'HEMA',brands:['Q903805'],kind:'shop'},
  {id:'Q151954',name:'Lidl',brands:['Q151954'],kind:'supermarket'},
  {id:'Q41171373',name:'Aldi',brands:['Q41171373'],kind:'supermarket'},
  {id:'Q1978981',name:'PLUS',brands:['Q1978981'],kind:'supermarket'},
  {id:'Q17502722',name:'Dirk',brands:['Q17502722'],kind:'supermarket'},
  {id:'Q2489350',name:'DekaMarkt',brands:['Q2489350'],kind:'supermarket'},
  {id:'Q3202837',name:'Vomar',brands:['Q3202837'],kind:'supermarket'},
  {id:'Q610492',name:'Spar',brands:['Q610492'],kind:'supermarket'},
  {id:'Q2226366',name:'Kruidvat',brands:['Q2226366'],kind:'shop'},
  {id:'Q2609459',name:'Etos',brands:['Q2609459'],kind:'shop'},
  {id:'Q2634111',name:'Action',brands:['Q2634111'],kind:'shop'},
  {id:'Q2294120',name:'Gamma',brands:['Q2294120'],kind:'shop'},
  {id:'Q2097480',name:'Karwei',brands:['Q2097480'],kind:'shop'},
  {id:'Q2741995',name:'Praxis',brands:['Q2741995'],kind:'shop'},
  {id:'Q54078',name:'IKEA',brands:['Q54078'],kind:'shop'}
]);
export const chainById = id => CHAIN_CATALOG.find(item => item.id === id) || null;
export const CHAIN_CACHE_KEY = 'chains.local.v1';
export const CHAIN_SYNC_INTERVAL = 30 * 24 * 60 * 60 * 1000;
