// Small, seamless procedural patterns; never fetch sprite/raster assets.
// Separate translucent fill overlay preserves the independently editable fill.
export const HATCH_OPTIONS = Object.freeze([
  { id: 'none', label: 'Geen' },
  { id: 'diagonal', label: 'Schuin' },
  { id: 'cross', label: 'Kruis' },
  { id: 'horizontal', label: 'Horizontaal' },
  { id: 'dots', label: 'Punten' }
]);
export const environmentHatchImageId = id => 'sharon-hatch-' + id;

export function createEnvironmentHatchTile(kind) {
  if (!HATCH_OPTIONS.some(entry => entry.id === kind && kind !== 'none')) return null;
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const positive = (x + y) % 8 === 0;
      const negative = (x - y + 16) % 8 === 0;
      const on = kind === 'diagonal' ? positive :
        kind === 'cross' ? positive || negative :
        kind === 'horizontal' ? y % 8 === 0 :
        kind === 'dots' && x % 8 === 2 && y % 8 === 2;
      if (!on) continue;
      const i = (y * size + x) * 4;
      data[i] = 62; data[i + 1] = 69; data[i + 2] = 73;
      data[i + 3] = kind === 'cross' ? 165 : 185;
    }
  }
  return { width: size, height: size, data };
}

export function registerEnvironmentHatches(map) {
  if (typeof map.addImage !== 'function') return;
  for (const option of HATCH_OPTIONS) {
    if (option.id === 'none') continue;
    const id = environmentHatchImageId(option.id);
    if (map.hasImage?.(id)) continue;
    map.addImage(id, createEnvironmentHatchTile(option.id));
  }
}
