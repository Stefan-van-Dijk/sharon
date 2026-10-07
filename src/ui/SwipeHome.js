const HORIZONTAL_RATIO = 1.25;
const SNAP_PROGRESS = 0.28;
const FLING_VELOCITY = 0.45;
const EDGE_PX = 104;
const DIRECTION_LOCK = 10;

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export function bindSwipeHome(surface, onHome, {
  isEnabled = () => true
} = {}) {
  if (!surface) return () => {};

  let gesture = null;
  let animating = false;

  const touchPoint = event =>
    event.touches?.[0] || event.changedTouches?.[0] || null;

  const isInteractiveTarget = target => {
    if (!target?.closest) return false;

    // A swipe row owns leftward gestures, but deliberately leaves
    // rightward gestures available for home navigation.
    if (target.closest('[data-swipe-surface]')) return false;

    return Boolean(target.closest(
      'input,textarea,select,a,button,[contenteditable="true"]'
    ));
  };

  const shift = () => Math.min(window.innerWidth * 0.55, 220);

  const setProgress = progress => {
    if (!gesture) return;

    progress = clamp(progress);
    gesture.progress = progress;

    const x = shift() * progress;
    surface.classList.toggle('is-home-swiping', progress > 0);
    surface.style.setProperty('--home-swipe-x', `${x}px`);
    surface.style.setProperty('--home-swipe-progress', String(progress));
    surface.style.setProperty('--home-swipe-radius', `${Math.round(20 * progress)}px`);
    surface.style.setProperty('--home-swipe-shadow', String((0.18 * progress).toFixed(3)));
  };

  const cleanup = () => {
    surface.classList.remove('is-home-swiping', 'is-home-swipe-animating');
    surface.style.removeProperty('--home-swipe-x');
    surface.style.removeProperty('--home-swipe-progress');
    surface.style.removeProperty('--home-swipe-radius');
    surface.style.removeProperty('--home-swipe-shadow');
    gesture = null;
    animating = false;
  };

  const animateTo = (target, done) => {
    if (!gesture) {
      done?.();
      return;
    }

    const from = gesture.progress;
    const distance = Math.abs(target - from);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : Math.round(120 + distance * 130);

    if (!duration) {
      setProgress(target);
      done?.();
      return;
    }

    animating = true;
    surface.classList.add('is-home-swipe-animating');

    const started = performance.now();

    const step = now => {
      if (!gesture) {
        animating = false;
        return;
      }

      const t = clamp((now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(from + (target - from) * eased);

      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }

      animating = false;
      done?.();
    };

    requestAnimationFrame(step);
  };

  const beginGesture = event => {
    if (!isEnabled() || animating || gesture) return;
    if (event.touches?.length !== 1) return;
    if (!surface.contains(event.target)) return;
    if (isInteractiveTarget(event.target)) return;

    const point = touchPoint(event);
    if (!point) return;

    const bounds = surface.getBoundingClientRect();
    const xInside = point.clientX - bounds.left;

    if (xInside < 0 || xInside > EDGE_PX) return;

    gesture = {
      startX: point.clientX,
      startY: point.clientY,
      dx: 0,
      dy: 0,
      horizontal: false,
      progress: 0,
      velocityX: 0,
      lastX: point.clientX,
      lastTime: performance.now()
    };
  };

  const moveGesture = event => {
    if (!gesture || animating) return;

    const point = touchPoint(event);
    if (!point) return;

    const now = performance.now();
    gesture.dx = point.clientX - gesture.startX;
    gesture.dy = point.clientY - gesture.startY;

    const ax = Math.abs(gesture.dx);
    const ay = Math.abs(gesture.dy);

    if (!gesture.horizontal) {
      if (ay > DIRECTION_LOCK && ay > ax) {
        gesture = null;
        return;
      }

      if (
        ax < DIRECTION_LOCK ||
        ax < ay * HORIZONTAL_RATIO
      ) {
        return;
      }

      if (gesture.dx <= 0) {
        gesture = null;
        return;
      }

      gesture.horizontal = true;
    }

    if (gesture.dx <= 0) return;

    const dt = Math.max(1, now - gesture.lastTime);
    const instantVelocity = (point.clientX - gesture.lastX) / dt;

    gesture.velocityX =
      gesture.velocityX * 0.55 +
      instantVelocity * 0.45;

    gesture.lastX = point.clientX;
    gesture.lastTime = now;

    if (event.cancelable) event.preventDefault();

    setProgress(gesture.dx / shift());
  };

  const endGesture = () => {
    if (!gesture || animating) return;

    if (!gesture.horizontal) {
      gesture = null;
      return;
    }

    const forward =
      gesture.progress >= SNAP_PROGRESS ||
      gesture.velocityX >= FLING_VELOCITY;

    if (!forward) {
      animateTo(0, cleanup);
      return;
    }

    // Keep the same Sharon shell. Swap its content to home while the
    // frame is displaced, then let the home state glide back into place.
    const returnHome = async () => {
      try {
        await onHome?.();
      } finally {
        if (!gesture) {
          cleanup();
          return;
        }
        animateTo(0, cleanup);
      }
    };

    animateTo(Math.max(gesture.progress, 0.42), returnHome);
  };

  const cancelGesture = () => {
    if (!gesture || animating) return;
    if (!gesture.horizontal) {
      gesture = null;
      return;
    }
    animateTo(0, cleanup);
  };

  document.addEventListener('touchstart', beginGesture, { passive: true });
  document.addEventListener('touchmove', moveGesture, { passive: false });
  document.addEventListener('touchend', endGesture, { passive: true });
  document.addEventListener('touchcancel', cancelGesture, { passive: true });

  return () => {
    document.removeEventListener('touchstart', beginGesture);
    document.removeEventListener('touchmove', moveGesture);
    document.removeEventListener('touchend', endGesture);
    document.removeEventListener('touchcancel', cancelGesture);
  };
}
