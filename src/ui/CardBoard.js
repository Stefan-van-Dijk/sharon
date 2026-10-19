import { renderCardCode } from './CardCodes.js?v=0.3.60';
const esc = v => String(v ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {loyalty:'Klantenpas',membership:'Lidmaatschap',access:'Toegangspas',ticket:'Ticket',other:'Overige kaart'};
export function openCardBoard(card,{locations=[],onClose=()=>{}}={}) {
 const fields = (Array.isArray(card.fields) ? card.fields : []).filter(f => f?.label && f?.value);
 const loc = locations.find(item => item.id === card.locationId);
 const extra = [...fields,...(card.cardNumber?[{label:'Zichtbaar pasnummer',value:card.cardNumber}]:[]),...(loc?[{label:'Locatie',value:loc.data?.title||'Locatie'}]:[])];
 const color = /^#[0-9a-f]{6}$/i.test(card.color||'') ? card.color : '#489ff8';
 const layer = document.createElement('div');
 layer.className = 'sh-card-board-overlay';
 layer.innerHTML = '<section class="sh-card-board" role="dialog" aria-modal="true" aria-label="Kaart '+esc(card.name)+'">' +
  '<div class="sh-card-board-accent" style="background:'+color+'"></div>' +
  '<div class="sh-card-board-top"><h2>'+esc(card.name)+'</h2><button type="button" data-close aria-label="Sluiten">×</button></div>' +
  '<div class="sh-card-board-code" data-code></div>' +
  (extra.length ? '<button type="button" data-expand class="sh-card-board-handle" aria-expanded="false"><span class="sh-card-board-grip"></span><span data-hint>Meer informatie</span></button>' +
  '<div data-details class="sh-card-board-details" hidden><div class="sh-card-board-detail-row"><span>Soort pas</span><strong>'+esc(labels[card.cardKind]||labels.other)+'</strong></div>' +
  extra.map(f=>'<div class="sh-card-board-detail-row"><span>'+esc(f.label)+'</span><strong>'+esc(f.value)+'</strong></div>').join('')+'</div>' : '') +
  '</section>';
 const board = layer.querySelector('.sh-card-board');
 const toggle = layer.querySelector('[data-expand]');
 const details = layer.querySelector('[data-details]');
 let expanded=false, startY=null, closed=false;
 const setExpanded = value => {
  if(!details) return;
  expanded=Boolean(value);details.hidden=!expanded;board.classList.toggle('is-expanded',expanded);
  toggle.setAttribute('aria-expanded',String(expanded));
  layer.querySelector('[data-hint]').textContent=expanded?'Minder informatie':'Meer informatie';
 };
 const close=()=>{if(closed)return;closed=true;window.removeEventListener('keydown',key);layer.remove();onClose();};
 const key=e=>{if(e.key==='Escape')close();if(e.key==='ArrowUp')setExpanded(true);if(e.key==='ArrowDown')setExpanded(false);};
 layer.querySelector('[data-close]').addEventListener('click',close);
 layer.addEventListener('click',e=>{if(e.target===layer)close();});
 toggle?.addEventListener('click',()=>setExpanded(!expanded));
 board.addEventListener('touchstart',e=>{if(e.touches.length===1)startY=e.touches[0].clientY;},{passive:true});
 board.addEventListener('touchend',e=>{if(startY===null||!e.changedTouches.length)return;const delta=e.changedTouches[0].clientY-startY;startY=null;if(delta>45){if(expanded)setExpanded(false);else close();}else if(delta < -45)setExpanded(true);},{passive:true});
 window.addEventListener('keydown',key);
 document.body.append(layer);
 const host=layer.querySelector('[data-code]');
 if(card.codeValue && card.codeFormat)renderCardCode(host,card.codeFormat,card.codeValue).catch(error=>{if(host.isConnected)host.textContent=error.message;});
 else host.textContent='Geen scanbare code opgeslagen.';
 layer.querySelector('[data-close]').focus({preventScroll:true});
 return close;
}
