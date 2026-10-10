const PINCH_RATE = 0.25;
const PAN_THRESHOLD_PX = 5;
const PINCH_THRESHOLD_RATIO = 0.08;

function touchSample(touches, element) {
  if (!touches.length || touches.length > 2) return null;
  const rect = element.getBoundingClientRect();
  const points = Array.from(touches, touch => ({
    x: touch.clientX - rect.left, y: touch.clientY - rect.top
  }));
  const center = points.length === 1 ? points[0] : {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2
  };
  return {
    count: points.length, center,
    distance: points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0
  };
}

// Own touch input explicitly: no tap-then-drag zoom and no zoom inertia.
// Native mouse, trackpad and keyboard handlers remain available.
export function bindEnvironmentTouchGestures(map, onStart = () => {}, {
  requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame
} = {}) {
  const element = map.getCanvasContainer();
  let state = null;
  let pending = null;
  let frame = 0;
  let moved = false;
  let lastDragAt = -Infinity;

  const discardFrame = () => {
    if (frame) cancelFrame(frame);
    frame = 0;
    pending = null;
  };
  const flush = () => {
    frame = 0;
    const sample = pending;
    pending = null;
    if (!sample || !state || sample.count !== state.count) return;
    const dx = sample.center.x - state.center.x;
    const dy = sample.center.y - state.center.y;
    if (!state.panning && Math.hypot(sample.center.x - state.origin.x,
      sample.center.y - state.origin.y) >= PAN_THRESHOLD_PX) state.panning = true;
    if (state.panning && (dx || dy)) {
      map.panBy([-dx, -dy], { duration: 0 });
      moved = true;
    }
    if (sample.count === 2 && sample.distance > 0 && state.distance > 0) {
      if (Math.abs(Math.log(sample.distance / state.startDistance)) >= PINCH_THRESHOLD_RATIO) {
        state.zooming = true;
      }
      if (state.zooming) {
        const delta = Math.log2(sample.distance / state.distance) * PINCH_RATE;
        if (delta) {
          map.easeTo({ zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
            around: map.unproject([sample.center.x, sample.center.y]), duration: 0 });
          moved = true;
        }
      }
    }
    if (state.panning) state.center = sample.center;
    state.distance = sample.distance;
  };
  const reset = touches => {
    const sample = touchSample(touches, element);
    state = sample ? { ...sample, origin: sample.center, startDistance: sample.distance,
      panning: false, zooming: false } : null;
  };
  const start = event => {
    event.stopImmediatePropagation();
    discardFrame();
    map.stop();
    onStart();
    if (!state) moved = false;
    reset(event.touches);
  };
  const move = event => {
    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();
    const sample = touchSample(event.touches, element);
    if (!sample || !state || sample.count !== state.count) {
      discardFrame(); reset(event.touches); return;
    }
    pending = sample;
    if (!frame) frame = requestFrame(flush);
  };
  const end = event => {
    event.stopImmediatePropagation();
    if (frame) { cancelFrame(frame); flush(); }
    if (moved) {
      lastDragAt = performance.now();
      if (event.cancelable) event.preventDefault();
    }
    reset(event.touches);
  };
  const cancel = event => {
    event.stopImmediatePropagation();
    discardFrame(); state = null;
    if (moved) lastDragAt = performance.now();
  };
  const click = event => {
    if (performance.now() - lastDragAt > 400) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const options = { capture: true, passive: false };
  for (const [name, handler] of [
    ['touchstart', start], ['touchmove', move], ['touchend', end],
    ['touchcancel', cancel], ['click', click]
  ]) element.addEventListener(name, handler, options);
  return () => {
    discardFrame(); state = null;
    for (const [name, handler] of [
      ['touchstart', start], ['touchmove', move], ['touchend', end],
      ['touchcancel', cancel], ['click', click]
    ]) element.removeEventListener(name, handler, options);
  };
}
