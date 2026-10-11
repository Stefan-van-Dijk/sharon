/**
 * Focus a visible text field synchronously in the originating user gesture.
 * On iOS Safari a focus delayed via setTimeout/animation can leave the
 * software keyboard closed. Browsers may still disallow keyboard activation
 * when there is no user gesture (for example after an automatic startup).
 */
export function focusTextField(input, { end = true } = {}) {
  if (!input || input.disabled || input.hidden || !input.isConnected) return false;
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
  if (end && typeof input.setSelectionRange === 'function') {
    try {
      const length = String(input.value ?? '').length;
      input.setSelectionRange(length, length);
    } catch {
      // Some input types (notably number) do not support a caret range.
    }
  }
  return true;
}
