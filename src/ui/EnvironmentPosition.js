import { bindEnvironmentButton } from './EnvironmentGestures.js?v=0.1.59';

// The return-to-position action stays usable while a shared GPS request is pending.
export function bindEnvironmentPositionButton(button, {
  location, getPoint, onPoint, onRefreshPoint = onPoint, onRequest = () => {}, onUnavailable = () => {}
}) {
  let pending = false;
  let disposed = false;
  const click = async () => {
    onRequest();
    const known = getPoint();
    if (known) onPoint(known);
    if (pending) return;
    pending = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const point = await location.checkNow({ reason: 'environment', maxAgeMs: 0,
        highAccuracy: true, browserMaxAgeMs: 0, timeoutMs: 10000 });
      if (!disposed) onRefreshPoint(point);
    } catch {
      if (!disposed) onUnavailable();
    } finally {
      pending = false;
      if (!disposed) button.setAttribute('aria-busy', 'false');
    }
  };
  const unbind = bindEnvironmentButton(button, click);
  return () => { disposed = true; unbind(); };
}
