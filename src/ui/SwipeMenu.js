const EDGE_PX = 34;
const OPEN_TRIGGER_PX = 72;
const CLOSE_TRIGGER_PX = 56;
const DIRECTION_LOCK = 8;

export function bindSwipeMenu(surface, drawer, {
  isEnabled = () => true,
  onOpenChange = () => {}
} = {}) {
  if (!surface || !drawer) {
    return {
      open() {},
      close() {},
      isOpen: () => false,
      destroy() {}
    };
  }

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startOffsetX = 0;
  let currentX = 0;
  let dragging = false;
  let locked = '';
  let openState = false;

  const drawerWidth = () => Math.min(window.innerWidth * 0.82, 340);

  const setX = (value, animate = false) => {
    const width = drawerWidth();
    currentX = Math.max(0, Math.min(width, value));
    const progress = width ? currentX / width : 0;

    surface.classList.toggle('is-menu-animating', animate);
    surface.classList.toggle('is-menu-dragging', currentX > 0 && !animate);
    surface.style.setProperty('--menu-x', `${currentX}px`);
    surface.style.setProperty('--menu-progress', String(progress));

    drawer.hidden = currentX <= 0 && !openState;
    drawer.setAttribute('aria-hidden', currentX > 0 || openState ? 'false' : 'true');
    drawer.style.setProperty('--menu-progress', String(progress));
  };

  const finishState = (open, animate = true) => {
    openState = open;
    const target = open ? drawerWidth() : 0;
    setX(target, animate);
    surface.classList.toggle('is-menu-open', open);
    drawer.classList.toggle('is-open', open);
    onOpenChange(open);

    if (!open) {
      setTimeout(() => {
        if (!openState && currentX === 0 && drawer.isConnected) {
          drawer.hidden = true;
          drawer.setAttribute('aria-hidden', 'true');
        }
      }, animate ? 280 : 0);
    }
  };

  const open = ({ animate = true } = {}) => finishState(true, animate);
  const close = ({ animate = true } = {}) => finishState(false, animate);

  const pointerDown = event => {
    if (!isEnabled()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;

    if (!openState && event.clientX > EDGE_PX) return;
    if (openState && !event.target.closest('[data-app-frame]')) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startOffsetX = openState ? drawerWidth() : currentX;
    dragging = false;
    locked = '';

    surface.classList.remove('is-menu-animating');
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
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
    if (!openState && dx <= 0) return;

    dragging = true;
    event.preventDefault();
    setX(startOffsetX + dx, false);
  };

  const pointerUp = event => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;

    if (!dragging || locked !== 'x') {
      locked = '';
      dragging = false;
      return;
    }

    const width = drawerWidth();

    if (openState) {
      finishState(currentX > width - CLOSE_TRIGGER_PX, true);
    } else {
      finishState(currentX >= OPEN_TRIGGER_PX, true);
    }

    surface.dataset.menuSwipeSuppressClick = '1';
    setTimeout(() => {
      if (surface.isConnected) delete surface.dataset.menuSwipeSuppressClick;
    }, 120);

    locked = '';
    dragging = false;
  };

  const pointerCancel = event => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    finishState(openState, true);
    locked = '';
    dragging = false;
  };

  document.addEventListener('pointerdown', pointerDown);
  document.addEventListener('pointermove', pointerMove, { passive: false });
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointercancel', pointerCancel);

  return {
    open,
    close,
    isOpen: () => openState,
    destroy() {
      document.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', pointerCancel);
    }
  };
}
