const paths={
  loyalty:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  membership:'<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
  access:'<circle cx="8" cy="9" r="4"/><path d="M11 12 21 22m-3-3 2-2m-5-1 2-2"/>',
  ticket:'<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M12 5v14" stroke-dasharray="2 2"/>',
  other:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9h8M8 13h6"/>'
};
export const cardSymbol=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[kind]||paths.other)+'</svg>';

// One palette and contrast rule for the editor, viewer and share board.
export function cardAppearance(value){
 const background=/^#[0-9a-f]{6}$/i.test(value||'')?value:'#489ff8';
 const rgb=background.slice(1).match(/../g).map(hex=>{const channel=parseInt(hex,16)/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;});
 const luminance=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
 return {background,foreground:(luminance+0.05)/0.05>=1.05/(luminance+0.05)?'#000':'#fff'};
}
export function applyCardAppearance(element,value){
 const appearance=cardAppearance(value);
 element.style.backgroundColor=appearance.background;
 element.style.setProperty('color',appearance.foreground,'important');
 return appearance;
}
