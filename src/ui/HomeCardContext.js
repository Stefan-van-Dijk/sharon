import { suggestCards, CARD_CONTEXT_MAX_AGE_MS } from '../core/location/CardContext.js?v=0.3.70';
import { openCardBoard } from './CardBoard.js?v=0.3.70';

// Home is a single entry point for the existing card deck, not a list of cards.
export function mountHomeCardContext(host, { store, location, events, trigger }) {
  let generation = 0, timer = null, closeBoard = null, disposed = false;
  let suggestions = [], objects = [];
  const updateTrigger = () => {
    const available = suggestions.length > 0;
    trigger.disabled = !available;
    trigger.setAttribute('aria-label', available ? 'Open relevante boards' : 'Geen relevante boards');
    trigger.title = available ? 'Relevante boards' : 'Geen relevante boards';
  };
  const close = () => { closeBoard?.(); closeBoard = null; };
  const open = () => {
    if (!suggestions.length || document.hidden) return;
    const fresh = suggestCards(objects, location.latest);
    if (!fresh.length) { refresh(); return; }
    close();
    closeBoard = openCardBoard(fresh[0].card, {
      cards: fresh.map(item => item.card), store, location, events,
      locations: objects.filter(item => item.type === 'location' && !item.deletedAt),
      onClose: () => { closeBoard = null; trigger.focus({ preventScroll: true }); }
    });
  };
  const refresh = async () => {
    const run = ++generation;
    clearTimeout(timer);
    if (document.hidden) { close(); suggestions = []; updateTrigger(); return; }
    try {
      const records = await store.getAll('objects');
      if (disposed || run !== generation) return;
      objects = records;
      suggestions = suggestCards(records, location.latest);
      updateTrigger();
      const point = location.latest;
      if (point?.at) timer = setTimeout(refresh, Math.max(1, point.at + CARD_CONTEXT_MAX_AGE_MS - Date.now()));
    } catch {
      if (!disposed && run === generation) { suggestions = []; updateTrigger(); }
    }
  };
  // The shared card board already implements an infinite horizontal deck.
  // Never render duplicate context cards vertically on Home.
  host.replaceChildren();
  host.hidden = true;
  trigger.addEventListener('click', open);
  const unsubscribe = events.on('location.changed', refresh);
  const offCards = events.on('cards.context.check', refresh);
  const onVisibility = () => { if (document.hidden) { close(); suggestions = []; updateTrigger(); } else refresh(); };
  document.addEventListener('visibilitychange', onVisibility);
  updateTrigger();
  refresh();
  return () => {
    disposed = true; generation++; clearTimeout(timer);
    unsubscribe(); offCards();
    document.removeEventListener('visibilitychange', onVisibility);
    trigger.removeEventListener('click', open);
    close(); suggestions = []; updateTrigger();
  };
}
