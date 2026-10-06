export function locationPolicy({
  hidden = false,
  activeTrip = false,
  activeLocationActions = false,
  manual = false
} = {}) {
  if (hidden) {
    return { mode: 'off', intervalMs: null, highAccuracy: false };
  }

  if (manual) {
    return { mode: 'one-shot', intervalMs: null, highAccuracy: true };
  }

  if (activeTrip) {
    return { mode: 'periodic', intervalMs: 60_000, highAccuracy: true };
  }

  if (activeLocationActions) {
    return { mode: 'on-demand', intervalMs: null, highAccuracy: false };
  }

  return { mode: 'on-demand', intervalMs: null, highAccuracy: false };
}
