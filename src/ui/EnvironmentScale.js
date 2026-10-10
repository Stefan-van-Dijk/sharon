// Match the original canvas levels: span is the longest visible map edge.
export const ENVIRONMENT_SCALES = Object.freeze([
  { id: 'near', label: 'Dichtbij', spanM: 70 },
  { id: 'detail', label: 'Detail', spanM: 220 },
  { id: 'street', label: 'Straat', spanM: 700 },
  { id: 'district', label: 'Wijk', spanM: 3000 },
  { id: 'place', label: 'Plaats', spanM: 15000 },
  { id: 'region', label: 'Regio', spanM: 70000 },
  { id: 'country', label: 'Land', spanM: 700000 }
]);
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const clampZoom = zoom => Math.max(1, Math.min(22, zoom));
const mapEdge = container => Math.max(1, container.clientWidth, container.clientHeight);
const latitudeScale = lat => Math.max(0.00001, Math.cos(lat * Math.PI / 180));

export function environmentScaleForSpan(spanM) {
  return ENVIRONMENT_SCALES.reduce((best, scale) =>
    Math.abs(Math.log(scale.spanM / spanM)) < Math.abs(Math.log(best.spanM / spanM)) ? scale : best);
}

export function nextEnvironmentScale(id) {
  const index = ENVIRONMENT_SCALES.findIndex(scale => scale.id === id);
  return ENVIRONMENT_SCALES[(index + 1) % ENVIRONMENT_SCALES.length];
}

export function environmentSpanForZoom(zoom, lat, container) {
  return mapEdge(container) * EARTH_CIRCUMFERENCE_M * latitudeScale(lat) / (512 * 2 ** zoom);
}

export function environmentZoomForSpan(spanM, lat, container) {
  return clampZoom(Math.log2(mapEdge(container) * EARTH_CIRCUMFERENCE_M * latitudeScale(lat) / (512 * spanM)));
}

export function configureEnvironmentGestures(map) {
  // Disable the composite handler, which also enables one-finger tap-drag zoom.
  map.touchZoomRotate.disable();
  map.doubleClickZoom.disable();
  map.scrollZoom.setZoomRate(1 / 300);
  map.scrollZoom.setWheelZoomRate(1 / 1400);
  map.keyboard.disableRotation();
}

// Interruptible native camera animation; pinch gestures remain direct.
export function environmentZoomTransition(map, zoom, { duration, around } = {}) {
  map.easeTo({
    zoom: clampZoom(zoom),
    duration: duration ?? Math.max(1000, Math.min(2200, Math.abs(zoom - map.getZoom()) * 250)),
    easing: progress => progress * progress * (3 - 2 * progress),
    ...(around ? { around } : {})
  });
}
