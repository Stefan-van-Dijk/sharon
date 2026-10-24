import { cardContextObjects } from '../core/chains/ChainModel.js?v=0.3.96';
import { suggestCards, CARD_CONTEXT_MAX_AGE_MS } from '../core/location/CardContext.js?v=0.3.96';
import { openCardBoard } from './CardBoard.js?v=0.3.96';

export function mountHomeCardContext(host, { store, location, events, trigger = null }) {
  let generation = 0, timer = null, closeBoard = null, openedId = null, disposed = false;
  const clear = () => {
    generation++;
    clearTimeout(timer);
    closeBoard?.(); closeBoard = null; openedId = null;
    host.replaceChildren(); host.hidden = true;
  };
  const refresh = async () => {
    const run = ++generation;
    clearTimeout(timer);
    if (document.hidden) { closeBoard?.(); closeBoard = null; openedId = null; return; }
    try {
      const objects = await cardContextObjects(store);
      if (disposed || run !== generation || !host.isConnected) return;
      const point = location.latest;
      const suggestions = suggestCards(objects, point);
      if (openedId && !suggestions.some(item => item.card.id === openedId)) {
        closeBoard?.(); closeBoard = null; openedId = null;
      }
      host.replaceChildren();
      host.hidden = true;
      if (trigger) { trigger.disabled = !suggestions.length; trigger.setAttribute('aria-label', suggestions.length ? 'Open relevante boards' : 'Geen relevante boards'); }
      if (!suggestions.length) return;
      const label = document.createElement('p');
      label.className = 'sh-context-label';
      label.textContent = 'Hier te gebruiken';
      host.append(label);
      for (const { card, location: place } of suggestions) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'sh-context-card';
        button.dataset.contextCard = card.id;
        const name = document.createElement('strong'), reason = document.createElement('small');
        name.textContent = card.name || 'Kaart';
        reason.textContent = `Bij ${place.data?.title || 'deze locatie'}`;
        button.append(name, reason);
        button.addEventListener('click', () => {
          // Recheck freshness at the actual moment of use.
          if (!suggestCards(objects, location.latest).some(item => item.card.id === card.id)) { clear(); return; }
          closeBoard?.(); openedId = card.id;
          closeBoard = openCardBoard(card, {
            cards: suggestions.map(item => item.card), store, location, events,
            onActiveCard: current => { openedId = current.id; },
            locations: [...objects.filter(item => item.type === 'location' && !item.deletedAt),...suggestions.map(item=>item.location)],
            onClose: () => { closeBoard = null; openedId = null; if (button.isConnected) button.focus({ preventScroll: true }); }
          });
        });
        host.append(button);
      }
      timer = setTimeout(refresh, Math.max(1, point.at + CARD_CONTEXT_MAX_AGE_MS - Date.now()));
    } catch { if (!disposed && run === generation) { host.replaceChildren(); if (trigger) trigger.disabled = true; } }
  };
  const openFromTrigger = () => host.querySelector('[data-context-card]')?.click();
  trigger?.addEventListener('click', openFromTrigger);
  const unsubscribe = events.on('location.changed', refresh);
  const offContext = events.on('cards.context.check', refresh);
  const onVisibility = () => { if (document.hidden) { closeBoard?.(); closeBoard = null; openedId = null; } else refresh(); };
  document.addEventListener('visibilitychange', onVisibility);
  refresh();
  return () => {
    if (disposed) return;
    disposed = true; trigger?.removeEventListener('click', openFromTrigger); unsubscribe(); offContext();
    document.removeEventListener('visibilitychange', onVisibility); clear(); if (trigger) trigger.disabled = true;
  };
}
