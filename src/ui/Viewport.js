export function viewportHeight(win, doc) {
  const vv = win.visualViewport;
  const visual = vv ? Number(vv.height) + Number(vv.offsetTop || 0) : 0;
  const editing = doc.activeElement?.matches('input,textarea,[contenteditable="true"]');
  // Shrink for the keyboard; otherwise use the full measured iOS app surface.
  return editing && visual > 0 ? visual : Math.max(Number(win.innerHeight) || 0, visual);
}

export function syncViewportHeight() {
  const height = viewportHeight(window, document);
  if (height > 0) document.documentElement.style.setProperty('--sharon-viewport-height', height + 'px');
}
