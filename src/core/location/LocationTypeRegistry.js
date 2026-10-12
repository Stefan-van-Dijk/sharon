// Shared location taxonomy. Stable IDs are used by onboarding and can be reused by filters/maps.
export const LOCATION_GROUPS = [
  { id:'personal', label:'Persoonlijk', types:['home','family','private','hotel'] },
  { id:'business', label:'Werk & zakelijk', types:['work','customer','construction','business'] },
  { id:'travel', label:'Onderweg', types:['parking','fuel','public'] },
  { id:'shops', label:'Winkels & horeca', types:['supermarket','shop','restaurant','hospitality'] },
  { id:'activities', label:'Activiteiten', types:['sport','school','healthcare'] },
  { id:'misc', label:'Overig', types:['other'] }
];
export const LOCATION_TYPES = [
  ['work','Werk','briefcase'],['customer','Klant','handshake'],['parking','Parkeren','parking'],
  ['fuel','Tankstation','fuel'],['supermarket','Supermarkt','basket'],['shop','Winkel','shopping-bag'],
  ['restaurant','Restaurant','utensils'],['hospitality','Horeca','coffee'],['family','Familie','users'],
  ['sport','Sport','activity'],['school','School','graduation-cap'],['healthcare','Zorg','heart-pulse'],
  ['hotel','Overnachten','bed-double'],['construction','Bouwplaats','hard-hat'],
  ['public','Openbaar','train-front'],['home','Thuis','house'],['business','Zakelijk','building-2'],
  ['private','Privé','user-round'],['other','Overig','map-pin']
].map(([id,label,icon]) => ({id,label,icon,group:LOCATION_GROUPS.find(g=>g.types.includes(id))?.id||'misc'}));
export const locationType = id => LOCATION_TYPES.find(t=>t.id===id);

export const LOCATION_ICON_GLYPHS = Object.freeze({
  home:'⌂', work:'▣', customer:'▣', business:'◇', private:'○',
  parking:'P', fuel:'◈', shop:'▤', supermarket:'▤',
  restaurant:'◒', hospitality:'◒', family:'⌂', sport:'◉',
  school:'▱', healthcare:'+', hotel:'⌂', construction:'△',
  public:'◎', other:'·'
});
export const locationIcon = id => LOCATION_ICON_GLYPHS[id] || '·';
