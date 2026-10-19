// Only the handle owns reordering. The strip keeps its existing tap/swipe actions.
export function bindDragOrder(root, { onMoveTo, onMove } = {}) {
  const handles = [...root.querySelectorAll('[data-list-drag]')];
  const scroll = root.closest('.app-view') || root;
  let gesture = null, frame = 0, saving = false;
  const itemOf = handle => handle.closest('[data-list-item], [data-node]');
  const clearMarks = () => root.querySelectorAll('.is-order-before,.is-order-after').forEach(item => item.classList.remove('is-order-before','is-order-after'));
  const update = () => {
    if (!gesture) return;
    const { item, startY, y, scrollTop, candidates } = gesture;
    item.style.transform = `translateY(${y - startY + scroll.scrollTop - scrollTop}px)`;
    clearMarks();
    gesture.target = null;
    let nearest = Infinity;
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect(), center = rect.top + rect.height / 2;
      const distance = Math.abs(y - center);
      if (distance < nearest) { nearest = distance; gesture.target = candidate; gesture.after = y > center; }
    }
    gesture.target?.classList.add(gesture.after ? 'is-order-after' : 'is-order-before');
  };
  const tick = () => {
    if (!gesture) return;
    if (!gesture.item.isConnected) { reset(); return; }
    const rect = scroll.getBoundingClientRect();
    if (rect.height > 0) {
      const delta = gesture.y < rect.top + 48 ? -8 : gesture.y > rect.bottom - 48 ? 8 : 0;
      if (delta) { scroll.scrollTop += delta; update(); }
    }
    frame = requestAnimationFrame(tick);
  };
  const reset = () => {
    if (!gesture) return;
    const { item, handle, pointerId } = gesture;
    gesture = null; cancelAnimationFrame(frame); clearMarks();
    item.classList.remove('is-order-dragging'); item.style.removeProperty('transform');
    handle.setAttribute('aria-pressed','false');
    try { handle.releasePointerCapture?.(pointerId); } catch {}
  };
  const down = event => {
    if (saving || gesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const handle = event.currentTarget, item = itemOf(handle);
    if (!item) return;
    const group = item.dataset.orderGroup || '';
    const candidates = handles.map(itemOf).filter(candidate => candidate && candidate !== item &&
      !candidate.closest('[hidden]') && (candidate.dataset.orderGroup || '') === group);
    if (!candidates.length) return;
    event.preventDefault(); event.stopPropagation();
    gesture = {handle,item,pointerId:event.pointerId,startY:event.clientY,y:event.clientY,
      scrollTop:scroll.scrollTop,candidates,target:null,after:false,moved:false};
    item.classList.add('is-order-dragging'); handle.setAttribute('aria-pressed','true');
    try { handle.setPointerCapture?.(event.pointerId); } catch {}
    frame = requestAnimationFrame(tick);
  };
  const move = event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    gesture.y = event.clientY;
    if (Math.abs(gesture.y - gesture.startY) >= 6) gesture.moved = true;
    if (gesture.moved) update();
  };
  const up = async event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const { handle, target, after, moved } = gesture;
    const id = handle.dataset.listDrag;
    const targetId = target?.querySelector('[data-list-drag]')?.dataset.listDrag;
    reset();
    if (!moved || !targetId) return;
    saving = true;
    try { await onMoveTo?.(id, targetId, after); }
    finally { saving = false; }
  };
  const cancel = () => reset();
  const click = event => { event.preventDefault(); event.stopPropagation(); };
  const key = async event => {
    if (!['ArrowUp','ArrowDown','Escape'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { reset(); return; }
    if (!saving) {
      saving = true;
      try { await onMove?.(event.currentTarget.dataset.listDrag,event.key === 'ArrowUp' ? -1 : 1); }
      finally { saving = false; }
    }
  };
  for (const handle of handles) {
    handle.addEventListener('pointerdown',down);
    handle.addEventListener('pointermove',move,{passive:false});
    handle.addEventListener('pointerup',up);
    handle.addEventListener('pointercancel',cancel);
    handle.addEventListener('lostpointercapture',cancel);
    handle.addEventListener('click',click);
    handle.addEventListener('keydown',key);
  }
  return () => {
    reset();
    for (const handle of handles) {
      handle.removeEventListener('pointerdown',down);handle.removeEventListener('pointermove',move);
      handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',cancel);
      handle.removeEventListener('lostpointercapture',cancel);handle.removeEventListener('click',click);handle.removeEventListener('keydown',key);
    }
  };
}
