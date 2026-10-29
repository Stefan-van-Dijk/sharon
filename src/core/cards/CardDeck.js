import { resolveLocation } from '../location/LocationHierarchy.js?v=0.4.27';
import { distanceBetween } from '../location/LocationTriggerService.js?v=0.4.27';

export function cardDistanceLabel(card, locations, point, now = Date.now()) {
  const lookup = new Map(locations.filter(item=>!item.deletedAt&&!item.archivedAt&&item.status!=='archived').map(item => [String(item.id),item]));
  const linked=lookup.get(String(card.locationId));
  const hasPosition=point&&point.lat!=null&&point.lng!=null&&Number.isFinite(Number(point.lat))&&Number.isFinite(Number(point.lng))&&Math.abs(Number(point.lat))<=90&&Math.abs(Number(point.lng))<=180&&Number.isFinite(point.at)&&point.at<=now&&now-point.at<120_000;
  if(!hasPosition)return String(linked?.data?.title||'');
  // This pill describes nearby saved context; it does not create a pass/location link.
  const candidates=[...lookup.values()].flatMap(item=>{
    const destination=resolveLocation(item,lookup).coordinates,name=String(item.data?.title||'').trim();
    return destination&&name?[{item,name,metres:distanceBetween(point,destination)}]:[];
  }).sort((a,b)=>a.metres-b.metres || Number(b.item.id===card.locationId)-Number(a.item.id===card.locationId) || a.name.localeCompare(b.name,'nl'));
  if(!candidates.length)return String(linked?.data?.title||'');
  const {name,metres}=candidates[0];
  return name+' · '+(metres<1000 ? Math.round(metres)+' m' : (metres/1000).toFixed(metres<10000?1:0)+' km');
}

export function cardDetailPages(card, locations = []) {
  const location = locations.find(item => item.id === card.locationId);
  const rows = [
    ...(card.cardNumber ? [{label:'Pasnummer',value:String(card.cardNumber)}] : []),
    ...(location?.data?.title ? [{label:'Locatie',value:location.data.title}] : []),
    ...(Array.isArray(card.fields) ? card.fields.filter(field => field?.label && field?.value) : [])
  ];
  const pages = []; let page = [], size = 0;
  for (const row of rows) {
    const value = String(row.value);
    for (let start = 0; start < value.length; start += 600) {
      const part = {label:String(row.label) + (start ? ' (vervolg)' : ''),value:value.slice(start,start+600)};
      if (page.length && (page.length >= 4 || size + part.value.length > 900)) {pages.push(page);page=[];size=0;}
      page.push(part);size += part.value.length;
    }
  }
  if (page.length || !pages.length) pages.push(page);
  return pages;
}

export function createCardDeck(card, cards = [], locations = []) {
  const pool = new Map(cards.filter(item => item?.id && !item.deletedAt && !item.archivedAt && item.status !== 'archived').map(item => [item.id,item]));
  pool.set(card.id,card);
  const ordered = [...pool.values()];
  const boards=ordered.flatMap((item,index)=>{
    const pages=cardDetailPages(item,locations);
    return pages.map((rows,page)=>({card:item,index,page,pages,rows}));
  });
  let boardIndex=Math.max(0,boards.findIndex(item=>item.card.id===card.id));
  const state=()=>({...boards[boardIndex],cards:ordered,boards,boardIndex});
  return {
    get state() {return state();},
    swipe(direction) {
      boardIndex=((boardIndex+direction)%boards.length+boards.length)%boards.length;
      return state();
    }
  };
}
