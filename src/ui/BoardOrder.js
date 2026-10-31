import { informationFeedback } from '../core/information/InformationFeedbackService.js?v=0.4.44';
import { informationReference, informationRank, distanceMeters } from '../core/information/InformationItem.js?v=0.4.44';

export const BOARD_ORDER_KEY = 'sharon.boards.order.v1';
export const BOARD_ORDERS = {discover:'Nog te ontdekken', nearby:'Dichtbij', relevant:'Relevant', popular:'Populair'};
export const BOARD_ORDER_EVENT = 'sharon-board-order-changed';
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
export function boardOrderMode() {
  const mode = read(BOARD_ORDER_KEY) ?? read('sharon.source.wikipedia.filters.v1')?.sort;
  return Object.hasOwn(BOARD_ORDERS,mode) ? mode : 'discover';
}
export function boardOrderIdentity(item) {
  const properties = item.properties || {}, data = item.data || {};
  if (properties.wikidata) return {key:'sharon.wiki.feedback.v1:'+properties.wikidata,
    reference:{source:'wikipedia',id:properties.wikidata,uri:'https://www.wikidata.org/entity/'+properties.wikidata}};
  const sourceRef = item.sourceRef || data.sourceRef;
  if (sourceRef) return {key:'sharon.place.feedback.v1:'+sourceRef,
    reference:{source:'openstreetmap',id:sourceRef,uri:'https://www.openstreetmap.org/'+sourceRef}};
  if (properties.source) return {key:'sharon.board.feedback.v1:'+properties.source+':'+item.id};
  return {key:'sharon.place.feedback.v1:location:'+item.id};
}
export function boardPoint(item) {
  const coords = item.geometry?.coordinates;
  return Array.isArray(coords) ? {lng:coords[0],lat:coords[1]} : item.data?.coordinates || item.coordinates;
}
export function sortBoards(items, center, mode = boardOrderMode()) {
  if (!Object.hasOwn(BOARD_ORDERS,mode)) mode = 'discover';
  const information = informationFeedback();
  return items.map((item,index) => {
    const identity=boardOrderIdentity(item), feedback=read(identity.key) || {};
    let summary;
    try { summary=identity.reference && information?.summary(informationReference(identity.reference)); } catch {}
    const distance=distanceMeters(center,boardPoint(item));
    const seen=feedback.read ?? summary?.own?.read ?? (identity.reference ? false : feedback.opened);
    // Missing community ratings stay neutral; never invent popularity counts.
    const score=mode==='discover' ? -Number(!!seen) : informationRank(summary,distance,mode);
    return {item,index,distance,score};
  }).sort((a,b) => (a.score===b.score ? 0 : a.score>b.score ? -1 : 1) ||
    (a.distance ?? Infinity)-(b.distance ?? Infinity) || a.index-b.index).map(row=>row.item);
}
const summaryLoads=new Map();
export function loadBoardSummaries(items) {
  const service=informationFeedback();if(!service)return;
  const references=items.flatMap(item=>{
    try { const ref=boardOrderIdentity(item).reference;return ref?[informationReference(ref)]:[]; } catch { return []; }
  });
  const needed=references.filter(ref=>{const key=ref.source+':'+ref.id;if(Date.now()-(summaryLoads.get(key)||0)<300000)return false;summaryLoads.set(key,Date.now());return true;});
  while(summaryLoads.size>4096)summaryLoads.delete(summaryLoads.keys().next().value);
  if(needed.length)service.load(needed).catch(()=>{for(const ref of needed)summaryLoads.delete(ref.source+':'+ref.id);});
}
export function markBoardOpened(item) {
  const identity=boardOrderIdentity(item);
  if(identity.reference) return; // Existing feedback controls own these states.
  try {localStorage.setItem(identity.key,JSON.stringify({...read(identity.key),opened:true}));} catch {}
}
