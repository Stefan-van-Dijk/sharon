// Wikidata identifiers verified against OSM's Name Suggestion Index.
export const CHAIN_CATALOG = Object.freeze([
  {id:'Q1653985',name:'Albert Heijn',brands:['Q1653985','Q78163765','Q77971185'],kind:'supermarket'},
  {id:'Q2262314',name:'Jumbo',brands:['Q2262314'],kind:'supermarket'},
  {id:'Q903805',name:'HEMA',brands:['Q903805'],kind:'shop'}
]);
export const chainById = id => CHAIN_CATALOG.find(item => item.id === id) || null;
export const CHAIN_CACHE_KEY = 'chains.local.v1';
export const CHAIN_SYNC_INTERVAL = 30 * 24 * 60 * 60 * 1000;
