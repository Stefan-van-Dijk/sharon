import { bindDragOrder } from './DragOrder.js?v=0.3.76';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = {
  recent: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
  alpha: '<span aria-hidden="true">A–Z</span>',
  near: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg>',
  custom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M3 4v16m-2-2 2 2 2-2"/></svg>'
};
const labels = {recent:'Recent',alpha:'A tot Z',near:'Dichtbij',custom:'Eigen volgorde'};
export function renderListControls({placeholder='Zoeken',query='',sort='alpha',near=false,cardHooks=false,locationHooks=false}={}) {
  return `<div class="sh-list-controls sh-card-search-toolbar"><label class="sh-list-search sh-card-search-row"><input data-list-search ${cardHooks?'data-card-search':''} type="search" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(query)}"></label><div class="sh-card-sort-icons" aria-label="Sorteren">${['recent','alpha',...(near?['near']:[]),'custom'].map(mode=>`<button type="button" data-list-sort="${mode}" ${cardHooks?`data-card-sort="${mode}"`:''} ${locationHooks?`data-sort="${mode}"`:''} aria-label="${labels[mode]}" title="${labels[mode]}" aria-pressed="${mode===sort}">${icon[mode]}</button>`).join('')}</div></div>`;
}
export function renderOrderControls(id) {
  return `<div class="sh-list-order"><button type="button" data-list-drag="${esc(id)}" aria-label="Versleep om de volgorde te wijzigen" aria-pressed="false" title="Versleep om de volgorde te wijzigen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/></svg></button></div>`;
}
export function bindListControls(root,{onSearch,onSort,onMove,onMoveTo}={}) {
  root.querySelector('[data-list-search]')?.addEventListener('input',event=>onSearch?.(event.target.value));
  root.querySelectorAll('[data-list-sort]').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;
    try { await onSort?.(button.dataset.listSort); } finally { button.disabled=false; }
  }));
  return bindDragOrder(root,{onMove,onMoveTo});
}
