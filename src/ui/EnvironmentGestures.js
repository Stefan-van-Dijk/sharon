const PAN_THRESHOLD_PX = 5;
const PAN_RATE = 0.5;
const PINCH_RATE = 0.6;

// Touch Events own finger input; Pointer Events own mouse/pen input. Keeping
// these paths separate avoids processing the same iOS gesture twice.
export function bindEnvironmentTouchGestures(map, onStart = () => {}) {
  const element = map.getContainer();
  const pointers = new Map();
  let previous = null, origin = null, moved = false, lastDragAt = -Infinity;
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
    if (!previous) { map.stop(); onStart(); moved = false; }
    previous = sample(points); origin = previous?.center;
  };
  const movePoints = points => {
    const current = sample(points);
    if (!current || !previous) { previous = current; origin = current?.center; return; }
    const dx = current.center.x - previous.center.x, dy = current.center.y - previous.center.y;
    if (!moved && Math.hypot(current.center.x - origin.x, current.center.y - origin.y) >= PAN_THRESHOLD_PX) moved = true;
    if (moved && (dx || dy)) map.panBy([-dx * PAN_RATE, -dy * PAN_RATE], { duration: 0 });
    if (current.distance > 0 && previous.distance > 0) {
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
    previous = sample(points); origin = previous?.center;
  };
  const down = event => {
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
  const touchStart = event => { event.stopImmediatePropagation(); begin(touches(event)); };
  const touchMove = event => {
    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();
    movePoints(touches(event));
  };
  const touchEnd = event => {
    event.stopImmediatePropagation();
    if (moved && event.cancelable) event.preventDefault();
    end(touches(event));
  };
  const click = event => {
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

// Native touch release activates the button even when iOS supplies no click
// or cancels pointer input. Mouse/keyboard continue to use ordinary clicks.
export function bindEnvironmentButton(button, action) {
  let start = null, lastTouchAt = -Infinity;
  const touchStart = event => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    start = touch ? { id: touch.identifier, x: touch.clientX, y: touch.clientY, moved: false } : null;
  };
  const touchMove = event => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    const touch = Array.from(event.touches).find(t => t.identifier === start?.id);
    if (touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) >= 10) start.moved = true;
  };
  const touchEnd = event => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    const touch = Array.from(event.changedTouches).find(t => t.identifier === start?.id);
    const tap = touch && !start.moved && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) < 10;
    start = null; lastTouchAt = performance.now();
    if (tap) action();
  };
  const cancel = () => { start = null; lastTouchAt = performance.now(); };
  const click = event => {
    if (event.detail !== 0 && performance.now() - lastTouchAt < 600) return;
    action();
  };
  const handlers = [['touchstart', touchStart], ['touchmove', touchMove],
    ['touchend', touchEnd], ['touchcancel', cancel], ['click', click]];
  for (const [name, fn] of handlers) button.addEventListener(name, fn, { passive: false });
  return () => { for (const [name, fn] of handlers) button.removeEventListener(name, fn); };
}
