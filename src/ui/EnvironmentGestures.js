const MOVE_THRESHOLD_PX = 2;

// Maps the previous touch midpoint onto the current midpoint at the desired
// zoom, using ONE camera update. At pitch/bearing=0, WebMercator pixels are
// affine at a fixed zoom: this keeps the map attached to the fingers.
export function cameraForEnvironmentGesture(map, previous, current) {
  const zoomBefore = map.getZoom();
  const pinch = previous.count === 2 && current.count === 2 &&
    previous.distance > 0 && current.distance > 0;
  const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(),
    zoomBefore + (pinch ? Math.log2(current.distance / previous.distance) : 0)));
  const ratio = 2 ** (zoom - zoomBefore);
  const container = map.getContainer();
  const cx = container.clientWidth / 2, cy = container.clientHeight / 2;
  // The camera center before this move is map.unproject([cx,cy]).
  // Project the old contact anchor into the new coordinate system, then
  // choose a new center that puts the anchor below the new contact point.
  const center = map.unproject([
    previous.center.x + (cx - current.center.x) / ratio,
    previous.center.y + (cy - current.center.y) / ratio
  ]);
  return { center, zoom };
}

// iOS Touch Events own fingers; Pointer Events own only mouse/pen.
// The native MapLibre touch handlers are disabled by EnvironmentScale.
export function bindEnvironmentTouchGestures(map, onStart = () => {}) {
  const element = map.getContainer();
  const pointers = new Map();
  let previous = null, origin = null, moved = false, lastDragAt = -Infinity;

  const point = event => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const sample = points => {
    if (!points.length || points.length > 2) return null;
    const count = points.length;
    const center = count === 1 ? points[0] : {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
    return { count, center, distance: count === 2 ?
      Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0 };
  };
  const begin = points => {
    const current = sample(points);
    if (!previous) moved = false;
    previous = current;
    origin = current;
  };
  const movePoints = points => {
    const current = sample(points);
    if (!current || !previous || current.count !== previous.count) {
      previous = current;
      origin = current;
      return;
    }
    if (!moved) {
      const pan = Math.hypot(current.center.x - origin.center.x,
        current.center.y - origin.center.y);
      const pinch = current.count === 2 &&
        Math.abs(current.distance - origin.distance);
      if (pan < MOVE_THRESHOLD_PX && pinch < MOVE_THRESHOLD_PX) return;
      map.stop();
      onStart();
      moved = true;
    }
    if (current.center.x !== previous.center.x ||
        current.center.y !== previous.center.y ||
        current.distance !== previous.distance) {
      map.jumpTo(cameraForEnvironmentGesture(map, previous, current));
    }
    previous = current;
  };
  const end = points => {
    if (moved) lastDragAt = performance.now();
    previous = sample(points);
    origin = previous;
    if (!previous) moved = false;
  };
  const isControl = event => event.target?.closest?.('button,a,input,select,textarea');
  const down = event => {
    if (isControl(event)) return;
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
  const touchStart = event => {
    if (isControl(event)) return;
    event.stopImmediatePropagation();
    begin(touches(event));
  };
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
  const touchCancel = event => {
    if (isControl(event)) return;
    event.stopImmediatePropagation();
    end([]);
  };
  const click = event => {
    if (isControl(event)) return;
    if (performance.now() - lastDragAt > 400) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const handlers = [['pointerdown', down], ['pointermove', move], ['pointerup', up],
    ['pointercancel', up], ['lostpointercapture', up], ['touchstart', touchStart],
    ['touchmove', touchMove], ['touchend', touchEnd], ['touchcancel', touchCancel], ['click', click]];
  for (const [name, fn] of handlers) element.addEventListener(name, fn, { capture: true, passive: false });
  return () => {
    for (const [name, fn] of handlers) element.removeEventListener(name, fn, true);
    for (const id of pointers.keys()) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    pointers.clear();
  };
}

export function bindEnvironmentButton(button, action) {
  button.addEventListener('click', action);
  return () => button.removeEventListener('click', action);
}
