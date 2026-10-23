import { cardContextObjects } from '../core/chains/ChainModel.js?v=0.3.88';
import { suggestCards, hasLeftCardLocation, CARD_CONTEXT_MAX_AGE_MS } from '../core/location/CardContext.js?v=0.3.88';
import { openCardBoard } from './CardBoard.js?v=0.3.88';

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
      const objects = await cardContextObjects(store);
      if (disposed || run !== generation) return;
      const point = location.latest;
      let changed = false;
      for (const id of seen) if (hasLeftCardLocation(objects, id.split('@')[0], point, Date.now(), id.split('@')[1] || null)) { seen.delete(id); changed = true; }
      if (changed) await persist();
      if (disposed || run !== generation) return;
      const suggestions = suggestCards(objects, point);
      const eligible = new Set(suggestions.map(item => item.card.id));
      if (openedIds.length && openedIds.some(id => !eligible.has(id))) close();
      const visitKey=item=>item.branch?item.card.id+'@'+item.branch.id:item.card.id;
      if (closePopup || !canOpen() || !suggestions.some(item => !seen.has(visitKey(item)))) return;
      for (const item of suggestions) seen.add(visitKey(item));
      openedIds = suggestions.map(item => item.card.id);
      const previousFocus = document.activeElement;
      const onClose = () => {
        closePopup = null; openedIds = []; clearTimeout(timer);
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      };
      // Automatic suggestions use the same deck as the Home boards button.
      closePopup = openCardBoard(suggestions[0].card, {
        cards: suggestions.map(item => item.card), store, location, events,
        onActiveCard: current => { openedIds = [current.id]; },
        locations: [...objects.filter(item => item.type === 'location' && !item.deletedAt),...suggestions.map(item=>item.location)], onClose
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

