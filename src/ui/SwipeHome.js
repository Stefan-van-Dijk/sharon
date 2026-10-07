const EDGE_PX = 56;
const TRIGGER_PX = 76;
const MAX_DRAG_PX = 180;
const DIRECTION_LOCK = 7;

export function bindSwipeHome(surface, onHome, {
  isEnabled = () => true
} = {}) {
  if (!surface) return () => {};

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let dragging = false;
  let locked = '';

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

  const reset = (animate = true) => {
    setX(0, animate);

    setTimeout(() => {
      if (!surface.isConnected || currentX !== 0) return;
      surface.classList.remove('is-home-swipe-animating', 'is-home-swiping');
      surface.style.removeProperty('--home-swipe-x');
      surface.style.removeProperty('--home-swipe-progress');
    }, animate ? 260 : 0);
  };

  const pointerDown = event => {
    if (!isEnabled()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;

    const bounds = surface.getBoundingClientRect();
    const xInside = event.clientX - bounds.left;
    if (xInside < 0 || xInside > EDGE_PX) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    currentX = 0;
    dragging = false;
    locked = '';

    surface.classList.remove('is-home-swipe-animating');

    try {
      surface.setPointerCapture(pointerId);
    } catch {}
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
    setX(dx, false);
  };

  const finish = async event => {
    if (pointerId !== event.pointerId) return;

    try {
      if (surface.hasPointerCapture(pointerId)) {
        surface.releasePointerCapture(pointerId);
      }
    } catch {}

    pointerId = null;

    if (!dragging || locked !== 'x') {
      reset(false);
      locked = '';
      dragging = false;
      return;
    }

    if (currentX >= TRIGGER_PX) {
      await onHome?.();
    }

    reset(true);
    locked = '';
    dragging = false;
  };

  const cancel = event => {
    if (pointerId !== event.pointerId) return;

    try {
      if (surface.hasPointerCapture(pointerId)) {
        surface.releasePointerCapture(pointerId);
      }
    } catch {}

    pointerId = null;
    reset(true);
    locked = '';
    dragging = false;
  };

  surface.addEventListener('pointerdown', pointerDown);
  surface.addEventListener('pointermove', pointerMove, { passive: false });
  surface.addEventListener('pointerup', finish);
  surface.addEventListener('pointercancel', cancel);

  return () => {
    surface.removeEventListener('pointerdown', pointerDown);
    surface.removeEventListener('pointermove', pointerMove);
    surface.removeEventListener('pointerup', finish);
    surface.removeEventListener('pointercancel', cancel);
  };
}
