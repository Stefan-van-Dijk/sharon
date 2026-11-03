export const SHOP_CATEGORIES = Object.freeze({
  groceries:'Boodschappen', fashion:'Mode & accessoires', care:'Verzorging & gezondheid',
  home:'Wonen & klussen', electronics:'Elektronica', leisure:'Sport & vrije tijd',
  food:'Eten & drinken', mobility:'Onderweg', services:'Diensten', local:'Eigen locaties', other:'Overig'
});
const kinds = {
  groceries:'supermarket convenience bakery butcher greengrocer seafood cheese deli farm frozen_food food health_food organic beverages alcohol wine tobacco',
  fashion:'clothes shoes fashion accessories bag jewellery watches second_hand boutique tailor',
  care:'chemist pharmacy cosmetics perfumery hairdresser beauty optician hearing_aids medical_supply dentist doctors clinic hospital',
  home:'doityourself hardware furniture kitchen bathroom houseware interior_decoration paint flooring carpet bed garden_centre florist trade building_materials lighting curtains',
  electronics:'electronics computer mobile_phone hifi electrical appliance',
  leisure:'sports outdoor bicycle books stationery toys games video_games music musical_instrument craft hobby pet fishing hunting art',
  food:'restaurant fast_food cafe coffee ice_cream pub bar food_court biergarten',
  mobility:'fuel charging_station car car_repair car_parts tyres motorcycle parking car_rental',
  services:'bank atm post_office parcel_locker dry_cleaning laundry copyshop travel_agency insurance estate_agent hairdresser_supply'
};
const byKind = new Map(Object.entries(kinds).flatMap(([category,values])=>values.split(' ').map(kind=>[kind,category])));
// The small offline catalogue uses generic "shop" for these established chains.
const offlineCategories = {Q903805:'home',Q2226366:'care',Q2609459:'care',Q2634111:'home',Q2294120:'home',Q2097480:'home',Q2741995:'home',Q54078:'home'};
export function shopCategory(item, catalog = []) {
  const data=item.data||{},chainId=item.chainId||data.chainId;
  if(item.type==='location'&&!chainId&&!data.sourceRef)return 'local';
  const chain=catalog.find(value=>value.id===chainId);
  const kind=[item.kind,data.kind,chain?.kind].find(value=>typeof value==='string'&&value.trim()&&value.trim().toLowerCase()!=='shop')?.toLowerCase().trim()||'shop';
  // Prefer the actual OSM type; never guess from an unknown brand name.
  return byKind.get(kind)||offlineCategories[chainId]||'other';
}

/** Eén rustige 24-pixel lijniconentaal voor filters, kaarten en beide bronnen. */
export const MAP_CATEGORY_PATHS=Object.freeze({
  groceries:'M3 5h2l2 11h12l2-8H6 M9 20h.01 M18 20h.01',
  fashion:'M8 3l4 3 4-3 5 5-4 3v10H7V11L3 8l5-5',
  care:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  home:'M3 11l9-8 9 8 M5 10v11h14V10 M10 21v-7h4v7',
  electronics:'M4 5h16v11H4z M8 20h8 M12 16v4',
  leisure:'M5 7l14 10 M5 17L19 7 M3 7l4-4 M17 21l4-4',
  food:'M5 3v8 M8 3v8 M11 3v8 M8 11v10 M16 3v18 M16 3c7 2 7 9 0 10',
  mobility:'M5 16l2-8h10l2 8 M3 16h18 M7 20h.01 M17 20h.01 M7 8l2-3h6l2 3',
  services:'M4 8l8-5 8 5 M5 9h14 M7 9v9 M12 9v9 M17 9v9 M4 19h16 M3 21h18',
  local:'M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z M9 9a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  erfgoed:'M5 21V8l7-5 7 5v13 M9 21v-7h6v7 M5 10h14',
  bouw:'M3 21V7h10v14 M13 11h8v10 M6 10h4 M6 14h4 M16 14h2 M16 18h2',
  natuur:'M12 3l7 11h-4l4 5H5l4-5H5z M12 19v3',
  cultuur:'M4 4h16v16H4z M8 15l3-3 3 2 3-5 M8 8h.01',
  vervoer:'M5 17V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11z M5 12h14 M8 21l2-4 M16 21l-2-4 M8 7h8',
  overig:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 8v4 M12 16h.01',
  other:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 8v4 M12 16h.01'
});
// Kept for compatibility with existing filters; use categoryIconSvg for rendering.
export const MAP_CATEGORY_SYMBOLS=Object.freeze(Object.fromEntries(Object.keys(MAP_CATEGORY_PATHS).map(key=>[key,key])));
export function categoryIconSvg(category, size=18){
  const key=Object.hasOwn(MAP_CATEGORY_PATHS,category)?category:'other';
  const s=Math.max(12,Math.min(32,Number(size)||18));
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+MAP_CATEGORY_PATHS[key]+'"/></svg>';
}
export function registerMapCategoryIcons(map){
  if(typeof document==='undefined'||typeof Path2D==='undefined')return;
  for(const [key,path] of Object.entries(MAP_CATEGORY_PATHS)){
    const name='sharon-category-'+key;
    if(map.hasImage?.(name))continue;
    const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    ctx.clearRect(0,0,48,48);
    ctx.fillStyle='#ffffff';ctx.strokeStyle='#56677c';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(24,24,22,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.save();ctx.translate(4,4);ctx.scale(40/24,40/24);
    ctx.strokeStyle='#344b60';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.stroke(new Path2D(path));ctx.restore();
    map.addImage(name,ctx.getImageData(0,0,48,48),{pixelRatio:2});
  }
}
