import { environmentScaleForSpan, nextEnvironmentScale, environmentSpanForZoom,
  environmentZoomForSpan, environmentZoomTransition } from './EnvironmentScale.js?v=0.1.60';

// Keep a requested destination while an animation runs. Repeated taps advance
// from that destination, rather than the camera's intermediate position.
export function createEnvironmentCameraControls(map, onManual = () => {}, onRequest = () => {}) {
  let targetZoom = null, targetScale = null;
  const clamp = zoom => Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
  const apply = (zoom, scale, duration) => {
    onManual();
    const from = map.getZoom();
    targetZoom = clamp(zoom); targetScale = scale;
    onRequest({ from, to: targetZoom, scale: targetScale });
    environmentZoomTransition(map, targetZoom, { duration });
  };
  return {
    step(direction) { apply((targetZoom ?? map.getZoom()) + direction * 0.5, null, 450); },
    nextScale() {
      const span = environmentSpanForZoom(targetZoom ?? map.getZoom(), map.getCenter().lat, map.getContainer());
      const next = nextEnvironmentScale(targetScale || environmentScaleForSpan(span).id);
      apply(environmentZoomForSpan(next.spanM, map.getCenter().lat, map.getContainer()), next.id);
    },
    settle() {
      // easeTo also emits moveend when replacing an unfinished animation.
      if (targetZoom !== null && Math.abs(map.getZoom() - targetZoom) < 0.0001) {
        targetZoom = null; targetScale = null;
      }
    },
    reset() { targetZoom = null; targetScale = null; }
  };
}
