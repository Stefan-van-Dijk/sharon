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
