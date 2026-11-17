const PARTS_ASSET = './assets/sharon-wordmark.svg?v=0.5.02';
const LOGO_ASSET = './assets/sharon-logo.svg?v=0.5.02';

export function sharonWordmark({
  mode = 'sharon',
  className = '',
  dataHook = '',
  label = 'Sharon'
} = {}) {
  const viewBox = mode === 'share'
    ? '0 12 245.1 70'
    : '0 12 198 70';

  return `
    <svg
      class="sharon-vector sharon-vector--${mode} ${className}"
      viewBox="${viewBox}"
      role="img"
      aria-label="${escapeAttribute(label)}"
      ${dataHook}
    >
      <g class="vector-part vector-shar">
        <use href="${PARTS_ASSET}#shar"></use>
      </g>
      <g class="vector-part vector-e">
        <use href="${PARTS_ASSET}#e"></use>
      </g>
      <g class="vector-part vector-logo">
        <g class="logo-layer logo-layer--outer-arcs"><use href="${PARTS_ASSET}#logo-outer-arcs"></use></g>
        <g class="logo-layer logo-layer--inner-ring"><use href="${PARTS_ASSET}#logo-inner-ring"></use></g>
        <g class="logo-layer logo-layer--diagonal-beam"><use href="${PARTS_ASSET}#logo-diagonal-beam"></use></g>
        <g class="logo-layer logo-layer--center-crescent"><use href="${PARTS_ASSET}#logo-center-crescent"></use></g>
      </g>
      <g class="vector-part vector-o">
        <use href="${PARTS_ASSET}#o"></use>
      </g>
      <g class="vector-part vector-n">
        <use href="${PARTS_ASSET}#n"></use>
      </g>
    </svg>
  `;
}

export function sharonLogo({
  className = '',
  dataHook = '',
  label = ''
} = {}) {
  return `
    <img
      class="sharon-logo-vector ${className}"
      src="${LOGO_ASSET}"
      alt="${escapeAttribute(label)}"
      ${label ? '' : 'aria-hidden="true"'}
      ${dataHook}
    >
  `;
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
