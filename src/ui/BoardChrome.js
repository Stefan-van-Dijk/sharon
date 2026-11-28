// Shared visual layers only; each module keeps its content and interactions.
export function boardDeckPill(label = '', labelAttribute = '') {
  return '<span data-deck-start aria-hidden="true"></span><span data-deck-label '+labelAttribute+'>'+label+'</span>'+
    '<svg data-deck-icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="3"/><path d="M7 3h10a3 3 0 0 1 3 3v11"/></svg>';
}

export function createBoardDeck() {
  const deck = document.createElement('div');
  deck.className = 'sh-board-deck';
  deck.setAttribute('aria-hidden', 'true');
  for (let n = 1; n <= 2; n++) {
    const card = document.createElement('div');
    card.className = 'sh-board-deck-card sh-board-deck-card-' + n;
    deck.append(card);
  }
  return deck;
}

export function wrapBoardSurface(overlay, surface) {
  const stack = document.createElement('div');
  stack.className = 'sh-board-stack';
  stack.append(createBoardDeck(), surface);
  overlay.append(stack);
  return stack;
}

export function createAppReturnSwipe(document, onReturn) {
  const edge = document.createElement('button');
  edge.type = 'button';
  edge.className = 'sh-app-return-swipe';
  edge.setAttribute('aria-label', 'Terug naar Sharon');
  edge.title = 'Veeg naar rechts om terug te gaan';
  edge.textContent = '›';
  let start = null;
  let moved = false;
  edge.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    moved = false;
    start = {id: event.pointerId, x: event.clientX, y: event.clientY};
    edge.setPointerCapture?.(event.pointerId);
  });
  edge.addEventListener('pointercancel', () => { start = null; });
  edge.addEventListener('pointerup', event => {
    if (start?.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    moved = Math.hypot(dx, dy) > 12;
    if (dx > 48 && dx > Math.abs(dy) * 1.25) onReturn();
  });
  edge.addEventListener('click', event => {
    if (event.detail === 0 || !moved) onReturn();
  });
  return edge;
}
