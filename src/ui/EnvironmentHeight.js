// Height intervals are opt-in. Moving the slider never splits a category.
// Intervals are half-open: (-infinity, cut0), [cut0, cut1), etc.
export const HEIGHT_TARGETS = Object.freeze({
  buildings: { label: 'Gebouwhoogte', min: 0, max: 300, step: 1, suggested: 20, unit: 'm' },
  land: { label: 'Terreinhoogte', min: -500, max: 9000, step: 25, suggested: 25, unit: 'm' }
});
export const MAX_HEIGHT_CUTS = 6;
const validColor = value => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
const validHatch = value => typeof value === 'string' &&
  ['none','diagonal','reverse','fine','wide','cross','crossfine','horizontal','vertical',
    'grid','dots','densedots','dash','brick','waves','diamonds'].includes(value);
function sanitizeBandStyle(entry, target) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {};
  const cleaned = {};
  if (validColor(entry.fill)) cleaned.fill = entry.fill.toLowerCase();
  if (target === 'buildings') {
    if (validColor(entry.stroke)) cleaned.stroke = entry.stroke.toLowerCase();
    if (validHatch(entry.hatch)) cleaned.hatch = entry.hatch;
  }
  return cleaned;
}
export function sanitizeHeightBands(input) {
  const result = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const [target, limits] of Object.entries(HEIGHT_TARGETS)) {
    const candidate = input[target];
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.cuts)) continue;
    const cuts = candidate.cuts.filter(value =>
      typeof value === 'number' && Number.isInteger(value) &&
      value > limits.min && value < limits.max &&
      (value - limits.min) % limits.step === 0
    ).sort((a, b) => a - b).filter((v, i, all) => i === 0 || v !== all[i - 1])
      .slice(0, MAX_HEIGHT_CUTS);
    if (!cuts.length) continue;
    const styles = Array.from({ length: cuts.length + 1 }, (_, i) =>
      sanitizeBandStyle(candidate.styles?.[i], target));
    result[target] = { cuts, styles };
  }
  return result;
}
export function addHeightCut(model, target, height) {
  const limits = HEIGHT_TARGETS[target];
  if (!limits || !Number.isInteger(height) || height <= limits.min || height >= limits.max ||
    (height - limits.min) % limits.step !== 0) return model;
  const current = sanitizeHeightBands(model);
  const band = current[target] || { cuts: [], styles: [{}] };
  if (band.cuts.includes(height) || band.cuts.length >= MAX_HEIGHT_CUTS) return current;
  const position = band.cuts.filter(cut => cut < height).length;
  const cuts = [...band.cuts, height].sort((a, b) => a - b);
  const styles = band.styles.map(style => ({ ...style }));
  // Splitting does not immediately change the colors.
  styles.splice(position + 1, 0, { ...(styles[position] || {}) });
  return { ...current, [target]: { cuts, styles } };
}
export function removeHeightCut(model, target, index) {
  const current = sanitizeHeightBands(model);
  const band = current[target];
  if (!band || !Number.isInteger(index) || index < 0 || index >= band.cuts.length) return current;
  const cuts = band.cuts.filter((_, i) => i !== index);
  if (!cuts.length) {
    const next = { ...current }; delete next[target]; return next;
  }
  const styles = band.styles.map(style => ({ ...style }));
  styles.splice(index + 1, 1);
  return { ...current, [target]: { cuts, styles } };
}
export function editHeightBand(model, target, index, field, value) {
  const current = sanitizeHeightBands(model);
  const band = current[target];
  if (!band || !Number.isInteger(index) || index < 0 || index > band.cuts.length) return current;
  const styles = band.styles.map(entry => ({ ...entry }));
  if (value === null) delete styles[index][field];
  else styles[index][field] = value;
  return sanitizeHeightBands({ ...current, [target]: { cuts: band.cuts, styles } });
}
export function heightBandLabel(model, target, index) {
  const cuts = sanitizeHeightBands(model)[target]?.cuts || [];
  if (index < 0 || index > cuts.length) return '';
  const lower = index ? cuts[index - 1] + ' m' : target === 'buildings' ? '0 m' : '−∞';
  const upper = index === cuts.length ? '∞' : cuts[index] + ' m';
  return lower + ' – ' + upper;
}
export function buildBuildingBandExpression(band, field, base, resolve, fallbackHeight = -1) {
  if (!band?.cuts?.length) return base;
  const measure = ['to-number', ['get', 'render_height'], fallbackHeight];
  const vals = band.styles.map((style, i) => resolve(style, i, field));
  const step = ['step', measure, vals[0], ...band.cuts.flatMap((cut, i) => [cut, vals[i + 1]])];
  // Unknown heights retain original style, not a falsely assigned height class.
  return ['case', ['has', 'render_height'], step, base];
}
export function buildLandReliefExpression(band, base, resolve) {
  if (!band?.cuts?.length) return null;
  const stops = [-12000, resolve(band.styles[0] || {}, 0, 'fill') || base];
  for (let i = 0; i < band.cuts.length; i++) {
    const edge = band.cuts[i];
    const previous = resolve(band.styles[i] || {}, i, 'fill') || base;
    const next = resolve(band.styles[i + 1] || {}, i + 1, 'fill') || base;
    stops.push(edge - .01, previous, edge, next);
  }
  stops.push(10000, resolve(band.styles[band.cuts.length] || {}, band.cuts.length, 'fill') || base);
  return ['interpolate', ['linear'], ['elevation'], ...stops];
}
