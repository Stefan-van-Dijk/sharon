const EDGE_PX = 34;
const TRIGGER_PX = 84;
const MAX_DRAG_PX = 220;
const DIRECTION_LOCK = 8;

export function bindSwipeHome(surface, onHome) {
  if (!surface) return () => {};

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let locked = '';
  let currentX = 0;

  const setX = (value, animate = false) => {
    currentX = Math.max(0, Math.min(MAX_DRAG_PX, value));
    surface.classList.toggle('is-home-swipe-animating', animate);
    surface.classList.toggle('is-home-swiping', currentX > 0);
    surface.style.setProperty('--home-swipe-x', `${currentX}px`);
    surface.style.setProperty(
      '--home-swipe-progress',
      String(Math.min(1, currentX / TRIGGER_PX))
    );
  };

  const reset = () => {
    surface.classList.add('is-home-swipe-animating');
    setX(0, true);
    setTimeout(() => {
      if (!surface.isConnected) return;
      surface.classList.remove('is-home-swipe-animating');
      surface.style.removeProperty('--home-swipe-x');
      surface.style.removeProperty('--home-swipe-progress');
    }, 260);
  };

  const complete = () => {
    surface.classList.add('is-home-swipe-complete');
    surface.style.setProperty('--home-swipe-x', '110vw');
    surface.style.setProperty('--home-swipe-progress', '1');
    setTimeout(() => onHome?.(), 180);
  };

  const pointerDown = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.clientX > EDGE_PX) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    locked = '';
    currentX = 0;
    surface.classList.remove('is-home-swipe-animating', 'is-home-swipe-complete');
  };

  const pointerMove = event => {
    if (pointerId !== event.pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!locked) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    if (locked !== 'x' || dx <= 0) return;

    dragging = true;
    event.preventDefault();
    setX(dx);
  };

  const pointerUp = event => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;

    if (!dragging || locked !== 'x') {
      locked = '';
      dragging = false;
      return;
    }

    if (currentX >= TRIGGER_PX) complete();
    else reset();

    locked = '';
    dragging = false;
  };

  surface.addEventListener('pointerdown', pointerDown);
  surface.addEventListener('pointermove', pointerMove, { passive: false });
  surface.addEventListener('pointerup', pointerUp);
  surface.addEventListener('pointercancel', pointerUp);

  return () => {
    surface.removeEventListener('pointerdown', pointerDown);
    surface.removeEventListener('pointermove', pointerMove);
    surface.removeEventListener('pointerup', pointerUp);
    surface.removeEventListener('pointercancel', pointerUp);
  };
}
