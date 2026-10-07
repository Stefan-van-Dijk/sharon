const OPEN_X = 176;
const OPEN_THRESHOLD_X = 48;
const DIRECTION_LOCK = 7;

export function bindSwipeRows(container, {
  onOpen,
  onEdit,
  onDelete
} = {}) {
  const rows = [...container.querySelectorAll('[data-swipe-row]')];
  let openRow = null;

  for (const row of rows) {
    const surface = row.querySelector('[data-swipe-surface]');
    const edit = row.querySelector('[data-swipe-edit]');
    const remove = row.querySelector('[data-swipe-delete]');
    if (!surface) continue;

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let currentX = 0;
    let dragging = false;
    let locked = '';

    const setX = (value, animate = false) => {
      currentX = Math.max(-OPEN_X, Math.min(0, value));
      surface.classList.toggle('is-animating', animate);
      surface.style.transform = `translate3d(${currentX}px,0,0)`;
      row.classList.toggle('is-actions-open', currentX < -1);

      if (currentX === 0 && openRow === row) openRow = null;
      if (currentX === -OPEN_X) openRow = row;
    };

    const close = (animate = true) => setX(0, animate);
    const open = (animate = true) => setX(-OPEN_X, animate);

    const pointerDown = event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      if (openRow && openRow !== row) {
        openRow.dispatchEvent(new CustomEvent('swipe.close'));
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startOffsetX = currentX;
      dragging = false;
      locked = '';
      surface.classList.remove('is-animating');
    };

    const pointerMove = event => {
      if (pointerId !== event.pointerId) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
        locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }

      if (locked !== 'x') return;

      dragging = true;
      event.preventDefault();
      setX(startOffsetX + dx);
    };

    const pointerUp = event => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;

      if (!dragging || locked !== 'x') {
        locked = '';
        dragging = false;
        return;
      }

      if (currentX <= -OPEN_THRESHOLD_X) {
        open(true);
      } else {
        close(true);
      }

      surface.dataset.swipeSuppressClick = '1';
      setTimeout(() => {
        if (surface.isConnected) delete surface.dataset.swipeSuppressClick;
      }, 80);

      locked = '';
      dragging = false;
    };

    surface.addEventListener('pointerdown', pointerDown);
    surface.addEventListener('pointermove', pointerMove, { passive: false });
    surface.addEventListener('pointerup', pointerUp);
    surface.addEventListener('pointercancel', pointerUp);

    surface.addEventListener('click', event => {
      if (surface.dataset.swipeSuppressClick === '1') {
        event.preventDefault();
        return;
      }

      if (currentX !== 0) {
        event.preventDefault();
        close(true);
        return;
      }

      onOpen?.(row.dataset.swipeRow, row);
    });

    edit?.addEventListener('click', () => {
      const id = row.dataset.swipeRow;
      close(false);
      onEdit?.(id, row);
    });

    remove?.addEventListener('click', () => {
      const id = row.dataset.swipeRow;
      onDelete?.(id, row);
    });

    row.addEventListener('swipe.close', () => close(true));
  }

  const closeAll = event => {
    if (!openRow) return;
    if (event.target.closest('[data-swipe-row]')) return;
    openRow.dispatchEvent(new CustomEvent('swipe.close'));
  };

  container.addEventListener('pointerdown', closeAll);

  return () => {
    container.removeEventListener('pointerdown', closeAll);
  };
}
