import { suggestCards, CARD_CONTEXT_MAX_AGE_MS } from '../core/location/CardContext.js?v=0.3.70';
import { openCardBoard } from './CardBoard.js?v=0.3.70';

// One Home entry point, reusing the existing board deck.
export function mountHomeCardContext(host, { store, location, events, trigger }) {
  let generation = 0, timer = null, closeBoard = null, disposed = false;
  let suggestions = [], objects = [];
  const updateTrigger = () => {
    if (!trigger?.isConnected) return;
    const available = suggestions.length > 0;
    trigger.disabled = !available;
    trigger.setAttribute('aria-label', available ? 'Open relevante boards' : 'Geen relevante boards');
    trigger.title = available ? 'Relevante boards' : 'Geen relevante boards';
  };
  const close = () => { const fn = closeBoard; closeBoard = null; fn?.(); };
  const refresh = async () => {
    const run = ++generation;
    clearTimeout(timer);
    if (document.hidden) { close(); suggestions = []; updateTrigger(); return; }
    try {
      const records = await store.getAll('objects');
      if (disposed || run !== generation || !host.isConnected) return;
      objects = records;
      suggestions = suggestCards(records, location.latest);
      if (!suggestions.length) close();
      updateTrigger();
      const point = location.latest;
      if (point?.at && suggestions.length) {
        const remaining = point.at + CARD_CONTEXT_MAX_AGE_MS - Date.now();
        if (remaining > 0) timer = setTimeout(refresh, remaining + 1);
      }
    } catch {
      if (!disposed && run === generation) { suggestions = []; close(); updateTrigger(); }
    }
  };
  const open = () => {
    if (!suggestions.length || document.hidden || disposed) return;
    const fresh = suggestCards(objects, location.latest);
    if (!fresh.length) { refresh(); return; }
    close();
    closeBoard = openCardBoard(fresh[0].card, {
      cards: fresh.map(item => item.card), store, location, events,
      locations: objects.filter(item => item.type === 'location' && !item.deletedAt),
      onClose: () => { closeBoard = null; if (trigger.isConnected) trigger.focus({ preventScroll: true }); }
    });
  };
  host.replaceChildren();
  host.hidden = true;
  trigger.addEventListener('click', open);
  const unsubscribe = events.on('location.changed', refresh);
  const offCards = events.on('cards.context.check', refresh);
  const onVisibility = () => { if (document.hidden) { generation++; clearTimeout(timer); close(); suggestions = []; updateTrigger(); } else refresh(); };
  document.addEventListener('visibilitychange', onVisibility);
  updateTrigger();
  refresh();
  return () => {
    if (disposed) return;
    disposed = true; generation++; clearTimeout(timer);
    unsubscribe(); offCards();
    document.removeEventListener('visibilitychange', onVisibility);
    trigger.removeEventListener('click', open);
    close(); suggestions = []; updateTrigger();
  };
}
