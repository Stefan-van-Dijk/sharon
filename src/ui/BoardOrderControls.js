import { BOARD_DISCOVERY_KEY, boardDiscoveryEnabled } from './BoardViewport.js?v=0.4.54';
import { BOARD_ORDERS, BOARD_ORDER_KEY, BOARD_ORDER_EVENT, boardOrderMode } from './BoardOrder.js?v=0.4.54';
export function mountBoardOrderControls(root) {
  const toggle=root.querySelector('[data-board-order-settings]'),panel=root.querySelector('[data-board-order-sheet]');
  // Preserve the previous Wikipedia preference before its filters are rewritten.
  try{localStorage.setItem(BOARD_ORDER_KEY,JSON.stringify(boardOrderMode()));}catch{}
  const buttons=[...panel.querySelectorAll('[data-board-order]')];
  const show=value=>{
    if(value){
      for(const sheet of root.querySelectorAll('[data-source-sheet],[data-places-sheet]')){sheet.classList.remove('is-open');sheet.setAttribute('aria-hidden','true');}
      for(const control of root.querySelectorAll('[data-wiki-settings],[data-chain-toggle]'))control.setAttribute('aria-expanded','false');
    }
    panel.hidden=!value;panel.classList.toggle('is-open',value);panel.setAttribute('aria-hidden',String(!value));toggle.setAttribute('aria-expanded',String(value));
  };
  const render=()=>{
    const mode=boardOrderMode();
    for(const button of panel.querySelectorAll('[data-board-discovery]'))button.setAttribute('aria-pressed',String((button.dataset.boardDiscovery==='expand')===boardDiscoveryEnabled()));
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.boardOrder===mode));
    toggle.title='Volgorde van boards: '+BOARD_ORDERS[mode];
    toggle.setAttribute('aria-label',toggle.title+'; instellen');
  };
  const click=event=>{
    if(event.target.closest('[data-board-order-settings]')){show(panel.hidden);return;}
    if(event.target.closest('[data-board-order-close]')){show(false);toggle.focus();return;}
    const discovery=event.target.closest('[data-board-discovery]');
    if(discovery&&panel.contains(discovery)){try{localStorage.setItem(BOARD_DISCOVERY_KEY,JSON.stringify(discovery.dataset.boardDiscovery==='expand'));}catch{}render();return;}
    const button=event.target.closest('[data-board-order]');
    if(!button||!panel.contains(button))return;
    try{localStorage.setItem(BOARD_ORDER_KEY,JSON.stringify(button.dataset.boardOrder));}catch{}
    render();window.dispatchEvent(new CustomEvent(BOARD_ORDER_EVENT));show(false);toggle.focus();
  };
  const key=event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();show(false);toggle.focus();}};
  root.addEventListener('click',click);window.addEventListener('keydown',key);render();
  return ()=>{root.removeEventListener('click',click);window.removeEventListener('keydown',key);};
}
export function closeBoardOrder(root) {
  const panel=root.querySelector('[data-board-order-sheet]');
  if(panel){panel.hidden=true;panel.classList.remove('is-open');panel.setAttribute('aria-hidden','true');}
  root.querySelector('[data-board-order-settings]')?.setAttribute('aria-expanded','false');
}
