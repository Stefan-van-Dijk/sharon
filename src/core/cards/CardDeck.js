export function cardDetailPages(card, locations = []) {
  const location = locations.find(item => item.id === card.locationId);
  const rows = [
    ...(card.cardNumber ? [{label:'Pasnummer',value:String(card.cardNumber)}] : []),
    ...(card.locationId ? [{label:'Locatie',value:location?.data?.title || 'Locatie niet beschikbaar'}] : []),
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
  let index = Math.max(0,ordered.findIndex(item => item.id === card.id)), expanded = false, page = 0;
  const state = () => ({card:ordered[index],cards:ordered,index,expanded,page,pages:cardDetailPages(ordered[index],locations)});
  return {
    get state() {return state();},
    expand(value) {expanded=Boolean(value);page=0;return state();},
    swipe(direction) {
      if (expanded) page=Math.max(0,Math.min(state().pages.length-1,page+direction));
      else {index=Math.max(0,Math.min(ordered.length-1,index+direction));page=0;}
      return state();
    }
  };
}
