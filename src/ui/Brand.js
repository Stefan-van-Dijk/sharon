const PARTS_ASSET = './assets/sharon-wordmark.svg?v=0.5.23';
const LOGO_ASSET = './assets/sharon-logo.svg?v=0.5.23';

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
        <g class="logo-layer logo-layer--outer-arcs"><image href="./assets/sharon-logo-outer-arcs.svg?v=0.5.23" x="126.02" y="37.57" width="35.26" height="35.26"></image></g>
        <g class="logo-layer logo-layer--inner-ring"><image href="./assets/sharon-logo-inner-ring.svg?v=0.5.23" x="126.02" y="37.57" width="35.26" height="35.26"></image></g>
        <g class="logo-layer logo-layer--diagonal-beam"><image href="./assets/sharon-logo-diagonal-beam.svg?v=0.5.23" x="126.02" y="37.57" width="35.26" height="35.26"></image></g>
        <g class="logo-layer logo-layer--center-crescent"><image href="./assets/sharon-logo-center-crescent.svg?v=0.5.23" x="126.02" y="37.57" width="35.26" height="35.26"></image></g>
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
