const PAN_THRESHOLD_PX = 5;
const PAN_RATE = 0.5;
const PINCH_RATE = 0.6;

// Touch Events own finger input; Pointer Events own mouse/pen input. Keeping
// these paths separate avoids processing the same iOS gesture twice.
export function bindEnvironmentTouchGestures(map, onStart = () => {}) {
  const element = map.getContainer();
  const pointers = new Map();
  let previous = null, origin = null, originDistance = 0, moved = false, lastDragAt = -Infinity;
  const sample = points => {
    if (!points.length || points.length > 2) return null;
    return { center: points.length === 1 ? points[0] : {
      x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2
    }, distance: points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0 };
  };
  const point = event => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const begin = points => {
    if (!previous) moved = false;
    previous = sample(points); origin = previous?.center; originDistance = previous?.distance || 0;
  };
  const movePoints = points => {
    const current = sample(points);
    if (!current || !previous) { previous = current; origin = current?.center; originDistance = current?.distance || 0; return; }
    const dx = current.center.x - previous.center.x, dy = current.center.y - previous.center.y;
    const pans = Math.hypot(current.center.x - origin.x, current.center.y - origin.y) >= PAN_THRESHOLD_PX;
    const pinches = current.distance > 0 && previous.distance > 0 && Math.abs(current.distance - originDistance) >= 3;
    if (!moved && (pans || pinches)) { map.stop(); onStart(); moved = true; }
    if (moved && (dx || dy)) map.panBy([-dx * PAN_RATE, -dy * PAN_RATE], { duration: 0 });
    if (moved && current.distance > 0 && previous.distance > 0) {
      const delta = Math.log2(current.distance / previous.distance) * PINCH_RATE;
      if (delta) {
        map.easeTo({ zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
          around: map.unproject([current.center.x, current.center.y]), duration: 0 });
        moved = true;
      }
    }
    previous = current;
  };
  const end = points => {
    if (moved) lastDragAt = performance.now();
    previous = sample(points); origin = previous?.center; originDistance = previous?.distance || 0;
  };
  const down = event => {
    if (event.target?.closest?.('button,a,input,select,textarea')) return;
    if (event.pointerType === 'touch' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointers.set(event.pointerId, point(event));
    element.setPointerCapture(event.pointerId);
    begin([...pointers.values()]);
  };
  const move = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point(event));
    movePoints([...pointers.values()]);
  };
  const up = event => {
    if (!pointers.delete(event.pointerId)) return;
    end([...pointers.values()]);
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  const touches = event => Array.from(event.touches, point);
  // Capture at the outer map element, before any renderer touch listeners.
  // The Sharon controls are outside this element and retain their own events.
  const isControl = event => event.target?.closest?.('button,a,input,select,textarea');
  const touchStart = event => { if (isControl(event)) return; event.stopImmediatePropagation(); begin(touches(event)); };
  const touchMove = event => {
    if (isControl(event)) return;
    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();
    movePoints(touches(event));
  };
  const touchEnd = event => {
    if (isControl(event)) return;
    event.stopImmediatePropagation();
    if (moved && event.cancelable) event.preventDefault();
    end(touches(event));
  };
  const click = event => {
    if (isControl(event)) return;
    if (performance.now() - lastDragAt > 400) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const handlers = [['pointerdown', down], ['pointermove', move], ['pointerup', up],
    ['pointercancel', up], ['lostpointercapture', up], ['touchstart', touchStart],
    ['touchmove', touchMove], ['touchend', touchEnd], ['touchcancel', touchEnd], ['click', click]];
  for (const [name, fn] of handlers) element.addEventListener(name, fn, { capture: true, passive: false });
  return () => {
    for (const [name, fn] of handlers) element.removeEventListener(name, fn, true);
    for (const id of pointers.keys()) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    pointers.clear();
  };
}

// Ordinary browser activation handles touch, mouse, keyboard and accessibility.
// This listener never cancels touchstart or substitutes a synthetic click.
export function bindEnvironmentButton(button, action) {
  button.addEventListener('click', action);
  return () => button.removeEventListener('click', action);
}
