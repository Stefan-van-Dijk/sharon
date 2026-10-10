const PAN_THRESHOLD_PX = 5;
const PINCH_RATE = 0.6;

// One owner for mouse, pen and touch. Capture keeps a drag active outside the
// canvas; UI buttons are siblings and never enter this gesture handler.
export function bindEnvironmentTouchGestures(map, onStart = () => {}) {
  const element = map.getCanvasContainer();
  const pointers = new Map();
  let previous = null, origin = null, moved = false, lastDragAt = -Infinity;
  const sample = () => {
    const points = [...pointers.values()];
    if (!points.length || points.length > 2) return null;
    return { center: points.length === 1 ? points[0] : {
      x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2
    }, distance: points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0 };
  };
  const point = event => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const down = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!pointers.size) { map.stop(); onStart(); moved = false; }
    pointers.set(event.pointerId, point(event));
    element.setPointerCapture(event.pointerId);
    previous = sample(); origin = previous?.center;
  };
  const move = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point(event));
    const current = sample();
    if (!current || !previous) { previous = current; origin = current?.center; return; }
    const dx = current.center.x - previous.center.x, dy = current.center.y - previous.center.y;
    if (!moved && Math.hypot(current.center.x - origin.x, current.center.y - origin.y) >= PAN_THRESHOLD_PX) moved = true;
    if (moved && (dx || dy)) map.panBy([-dx, -dy], { duration: 0 });
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
  const up = event => {
    if (!pointers.delete(event.pointerId)) return;
    if (moved) lastDragAt = performance.now();
    previous = sample(); origin = previous?.center;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  const click = event => {
    if (performance.now() - lastDragAt > 400) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const handlers = [['pointerdown', down], ['pointermove', move], ['pointerup', up],
    ['pointercancel', up], ['lostpointercapture', up], ['click', click]];
  for (const [name, fn] of handlers) element.addEventListener(name, fn, { capture: true, passive: false });
  return () => {
    for (const [name, fn] of handlers) element.removeEventListener(name, fn, true);
    for (const id of pointers.keys()) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    pointers.clear();
  };
}

// Safari can suppress synthetic clicks after touch gestures. Activate touch
// buttons on release, suppress the duplicate click, and retain keyboard clicks.
export function bindEnvironmentButton(button, action) {
  let start = null, lastTouchAt = -Infinity;
  const down = event => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  };
  const up = event => {
    if (!start || start.id !== event.pointerId) return;
    const tap = Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10;
    start = null;
    lastTouchAt = performance.now();
    event.preventDefault();
    if (tap) action();
  };
  const cancel = () => { start = null; };
  const click = event => {
    if (event.detail !== 0 && performance.now() - lastTouchAt < 600) return;
    action();
  };
  const handlers = [['pointerdown', down], ['pointerup', up], ['pointercancel', cancel], ['click', click]];
  for (const [name, fn] of handlers) button.addEventListener(name, fn);
  return () => { for (const [name, fn] of handlers) button.removeEventListener(name, fn); };
}
