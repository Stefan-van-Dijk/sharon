function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function actionMarkup(action) {
  if (!action) return '';
  const kind = action.kind || 'secondary';
  const data = kind === 'delete' ? 'data-swipe-delete' : kind === 'edit' ? 'data-swipe-edit' : 'data-swipe-secondary';
  const className = kind === 'delete' ? 'swipe-action-delete' : kind === 'edit' ? 'swipe-action-edit' : 'swipe-action-secondary';
  return `<button type="button" class="${className}" ${data}${action.ariaLabel ? ` aria-label="${escapeAttribute(action.ariaLabel)}"` : ''}>${action.html ?? escapeHtml(action.label || '')}</button>`;
}

/**
 * Generic Sharon strip. Modules own content and policy; this component owns
 * the shared row structure used by SwipeRows.
 */
export function renderStrip({
  id,
  className = '',
  ariaLabel = '',
  leadingHtml = '',
  title = '',
  subtitle = '',
  bodyHtml = '',
  trailingHtml = '',
  actions = [],
  singleAction = false,
  doubleSwipe = false
} = {}) {
  const actionList = actions.filter(Boolean);
  const flags = [
    singleAction ? 'data-swipe-single' : '',
    doubleSwipe ? 'data-double-swipe' : ''
  ].filter(Boolean).join(' ');
  const copy = bodyHtml || `<span class="sh-strip-copy"><strong>${escapeHtml(title)}</strong>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}</span>`;
  return `<div class="swipe-row sh-strip ${escapeAttribute(className)}" data-swipe-row="${escapeAttribute(id)}" ${flags}>
    ${actionList.length ? `<div class="swipe-actions">${actionList.map(actionMarkup).join('')}</div>` : ''}
    <button type="button" class="clean-row swipe-surface sh-strip-surface" data-swipe-surface${ariaLabel ? ` aria-label="${escapeAttribute(ariaLabel)}"` : ''}>
      ${leadingHtml}<span class="sh-strip-content">${copy}</span>${trailingHtml}
    </button>
  </div>`;
}
