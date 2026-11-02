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

/** Shared visual vocabulary: source filters and map markers use the same icons. */
export const MAP_CATEGORY_SYMBOLS=Object.freeze({
  groceries:'🛒',fashion:'👕',care:'✚',home:'⌂',electronics:'⚡',
  leisure:'★',food:'☕',mobility:'➜',services:'●',local:'⌖',
  erfgoed:'♜',bouw:'▣',natuur:'♣',cultuur:'♫',vervoer:'↗',overig:'•',other:'•'
});
export function registerMapCategoryIcons(map){
  if(typeof document==='undefined')return;
  for(const [key,glyph] of Object.entries(MAP_CATEGORY_SYMBOLS)){
    const name='sharon-category-'+key;
    if(map.hasImage?.(name))continue;
    const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(20,20,18,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#56677c';ctx.lineWidth=2;ctx.stroke();
    ctx.font='bold 23px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#324c64';
    ctx.fillText(glyph,20,21,29);
    map.addImage(name,ctx.getImageData(0,0,40,40),{pixelRatio:2});
  }
}
