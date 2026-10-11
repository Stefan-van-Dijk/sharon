// Seamless, local, transparent pattern sprites shared by map and visual picker.
// All periods divide 16, so adjacent raster tiles meet without visible seams.
export const HATCH_OPTIONS = Object.freeze([
  { id: 'none', label: 'Geen' },
  { id: 'diagonal', label: 'Schuin /' },
  { id: 'reverse', label: 'Schuin \\' },
  { id: 'fine', label: 'Fijn schuin' },
  { id: 'wide', label: 'Ruim schuin' },
  { id: 'cross', label: 'Kruis' },
  { id: 'crossfine', label: 'Fijn kruis' },
  { id: 'horizontal', label: 'Horizontaal' },
  { id: 'vertical', label: 'Verticaal' },
  { id: 'grid', label: 'Raster' },
  { id: 'dots', label: 'Punten' },
  { id: 'densedots', label: 'Fijne punten' },
  { id: 'dash', label: 'Strepen' },
  { id: 'brick', label: 'Metselwerk' },
  { id: 'waves', label: 'Golven' },
  { id: 'diamonds', label: 'Ruiten' }
]);

export const environmentHatchImageId = id => 'sharon-hatch-' + id;
const mod = (n, divisor) => ((n % divisor) + divisor) % divisor;

function pixelOn(kind, x, y) {
  const diag = mod(x + y, 8) === 0;
  const reverse = mod(x - y, 8) === 0;
  switch (kind) {
    case 'diagonal': return diag;
    case 'reverse': return reverse;
    case 'fine': return mod(x + y, 4) === 0;
    case 'wide': return mod(x + y, 16) === 0;
    case 'cross': return diag || reverse;
    case 'crossfine': return mod(x + y, 4) === 0 || mod(x - y, 4) === 0;
    case 'horizontal': return y % 8 === 0;
    case 'vertical': return x % 8 === 0;
    case 'grid': return x % 8 === 0 || y % 8 === 0;
    case 'dots': return x % 8 === 2 && y % 8 === 2;
    case 'densedots': return x % 4 === 1 && y % 4 === 1;
    case 'dash': return y % 8 === 0 && x % 8 < 4;
    case 'brick':
      return y % 8 === 0 ||
        ((y < 8 && x % 8 === 0) || (y >= 8 && x % 8 === 4));
    case 'waves':
      return mod(y - Math.round(Math.sin(x * Math.PI / 8) * 2), 8) === 0;
    case 'diamonds':
      return mod(Math.abs(mod(x, 8) - 4) + Math.abs(mod(y, 8) - 4), 8) === 0;
    default: return false;
  }
}

export function createEnvironmentHatchTile(kind) {
  if (!HATCH_OPTIONS.some(entry => entry.id === kind && kind !== 'none')) return null;
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!pixelOn(kind, x, y)) continue;
      const i = (y * size + x) * 4;
      data[i] = 62; data[i + 1] = 69; data[i + 2] = 73;
      data[i + 3] = kind === 'crossfine' || kind === 'grid' ? 145 : 185;
    }
  }
  return { width: size, height: size, data };
}

// Same pixels in the map and the picker: compact SVG path, no remote assets.
// Safe token is supplied from fixed ids and unique per preview occurrence.
export function environmentHatchPreview(kind, token) {
  if (kind === 'none' || !createEnvironmentHatchTile(kind)) {
    return '<svg viewBox="0 0 64 30" aria-hidden="true"><rect x="1" y="1" width="62" height="28" fill="none" stroke="#b0b0b5" stroke-dasharray="3 3"/><path d="M6 26L58 4" stroke="#b5b5ba" stroke-width="1.2"/></svg>';
  }
  const { width, height, data } = createEnvironmentHatchTile(kind);
  let path = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]) path += 'M' + x + ' ' + y + 'h1v1h-1z';
    }
  }
  const id = 'sharon-hatch-preview-' + token;
  return '<svg viewBox="0 0 64 30" aria-hidden="true"><defs><pattern id="' + id +
    '" width="16" height="16" patternUnits="userSpaceOnUse"><path fill="#53585c" d="' +
    path + '"/></pattern></defs><rect width="64" height="30" fill="url(#' + id +
    ')"/></svg>';
}

export function registerEnvironmentHatches(map) {
  if (typeof map.addImage !== 'function') return;
  // An explicit fully transparent sprite allows feature-driven fill-patterns
  // to turn off hatches for individual building-height bands.
  if (!map.hasImage?.(environmentHatchImageId('none'))) {
    map.addImage(environmentHatchImageId('none'), {
      width: 16, height: 16, data: new Uint8Array(16 * 16 * 4)
    });
  }
  for (const option of HATCH_OPTIONS) {
    if (option.id === 'none') continue;
    const id = environmentHatchImageId(option.id);
    if (map.hasImage?.(id)) continue;
    map.addImage(id, createEnvironmentHatchTile(option.id));
  }
}
