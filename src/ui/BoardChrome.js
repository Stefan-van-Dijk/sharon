// Shared visual layers only; each module keeps its content and interactions.
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
