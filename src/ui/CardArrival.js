import { suggestCards, hasLeftCardLocation, CARD_CONTEXT_MAX_AGE_MS } from '../core/location/CardContext.js?v=0.3.69';
import { openCardBoard } from './CardBoard.js?v=0.3.69';
import { wrapBoardSurface } from './BoardChrome.js?v=0.3.69';

const VISIT_KEY = 'cards.context.visit';

export function mountCardArrival({ store, location, events, canOpen = () => true }) {
  let disposed = false, generation = 0, closePopup = null, openedIds = [], timer = null;
  const seen = new Set();
  const ready = store.get('meta', VISIT_KEY).then(record => {
    for (const id of Array.isArray(record?.value) ? record.value : []) if (typeof id === 'string') seen.add(id);
  }).catch(() => {});
  const persist = () => store.put('meta', { key: VISIT_KEY, value: [...seen] }).catch(() => {});
  const close = () => { clearTimeout(timer); closePopup?.(); closePopup = null; openedIds = []; };
  const refresh = async () => {
    const run = ++generation;
    if (document.hidden) { close(); return; }
    try {
      await ready;
      const objects = await store.getAll('objects');
      if (disposed || run !== generation) return;
      const point = location.latest;
      let changed = false;
      for (const id of seen) if (hasLeftCardLocation(objects, id, point)) { seen.delete(id); changed = true; }
      if (changed) await persist();
      if (disposed || run !== generation) return;
      const suggestions = suggestCards(objects, point);
      const eligible = new Set(suggestions.map(item => item.card.id));
      if (openedIds.length && openedIds.some(id => !eligible.has(id))) close();
      if (closePopup || !canOpen() || !suggestions.some(item => !seen.has(item.card.id))) return;
      for (const item of suggestions) seen.add(item.card.id);
      openedIds = suggestions.map(item => item.card.id);
      const previousFocus = document.activeElement;
      const onClose = () => {
        closePopup = null; openedIds = []; clearTimeout(timer);
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      };
      const showCard = card => {
        closePopup = openCardBoard(card, { cards: suggestions.map(item => item.card), store, location, events,
          onActiveCard: current => { openedIds = [current.id]; },
          locations: objects.filter(item => item.type === 'location' && !item.deletedAt), onClose });
        openedIds = [card.id];
      };
      if (suggestions.length === 1) showCard(suggestions[0].card);
      else closePopup = openChoice(suggestions, {
        onClose,
        onSelect: card => { close(); showCard(card); scheduleExpiry(); }
      });
      function scheduleExpiry() {
        clearTimeout(timer);
        timer = setTimeout(close, Math.max(1, point.at + CARD_CONTEXT_MAX_AGE_MS - Date.now()));
      }
      scheduleExpiry();
      await persist();
    } catch { /* Context must never block the active module. */ }
  };
  const offLocation = events.on('location.changed', refresh);
  const offView = events.on('cards.context.check', refresh);
  const onVisibility = () => { if (document.hidden) { generation++; close(); } else refresh(); };
  document.addEventListener('visibilitychange', onVisibility);
  refresh();
  return () => {
    disposed = true; generation++; close(); offLocation(); offView();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

function openChoice(suggestions, { onClose, onSelect }) {
  const layer = document.createElement('div');
  layer.className = 'sh-card-board-overlay';
  layer.innerHTML = '<section class="sh-card-board" role="dialog" aria-modal="true" aria-label="Kies een pas" tabindex="-1"><div class="sh-card-board-top"><h2>Welke pas wil je gebruiken?</h2></div><div data-card-choices></div></section>';
  wrapBoardSurface(layer, layer.querySelector('.sh-card-board'));
  let closed = false, startY = null;
  const close = () => { if (closed) return; closed = true; window.removeEventListener('keydown', key); layer.remove(); onClose(); };
  const key = event => { if (event.key === 'Escape') close(); };
  const host = layer.querySelector('[data-card-choices]');
  for (const { card, location: place } of suggestions) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sh-context-card'; button.dataset.arrivalChoice = card.id;
    const name = document.createElement('strong'), reason = document.createElement('small');
    name.textContent = card.name; reason.textContent = place.data?.title || 'Deze locatie';
    button.append(name, reason);
    button.addEventListener('click', () => onSelect(card));
    host.append(button);
  }
  layer.addEventListener('sharon:close-board',close);
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  layer.addEventListener('touchstart', event => { if (event.touches.length === 1) startY = event.touches[0].clientY; }, { passive: true });
  layer.addEventListener('touchend', event => { if (startY !== null && event.changedTouches[0]?.clientY - startY > 45) close(); startY = null; }, { passive: true });
  window.addEventListener('keydown', key); document.body.append(layer);
  layer.querySelector('[role="dialog"]').focus({ preventScroll: true });
  return close;
}
