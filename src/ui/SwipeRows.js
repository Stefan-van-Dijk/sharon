const DEFAULT_OPEN_X = 176;
const OPEN_THRESHOLD_X = 48;
const DIRECTION_LOCK = 7;

export function bindSwipeRows(container, {
  onOpen,
  onEdit,
  onDelete,
  onSecondary,
  onShare
} = {}) {
  const rows = [...container.querySelectorAll('[data-swipe-row]')];
  const cleanups = [];
  const listen = (target,type,handler,options) => {
    if (!target) return;
    target.addEventListener(type,handler,options);
    cleanups.push(()=>target.removeEventListener(type,handler,options));
  };
  let openRow = null;

  for (const row of rows) {
    const surface = row.querySelector('[data-swipe-surface]');
    const canShare=row.hasAttribute('data-shareable')&&typeof onShare==='function';
    listen(row.querySelector('[data-swipe-share]'),'click',()=>onShare?.(row.dataset.swipeRow,row));
    const edit = row.querySelector('[data-swipe-edit]');
    const remove = row.querySelector('[data-swipe-delete]');
    const secondary = row.querySelector('[data-swipe-secondary]');
    const doubleSwipe = row.hasAttribute('data-double-swipe');
    const singleAction = row.hasAttribute('data-swipe-single');
    if (!surface) continue;

    const actionWidth = () => singleAction ? 88 : doubleSwipe ? 176 : Math.max(88, Math.min(DEFAULT_OPEN_X, row.querySelector('.swipe-actions')?.getBoundingClientRect().width || DEFAULT_OPEN_X));
    const firstWidth = () => doubleSwipe ? 88 : actionWidth();
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let currentX = 0;
    let dragging = false;
    let locked = '';
    let suppressTimer;
    const suppressClick = () => {
      clearTimeout(suppressTimer);surface.dataset.swipeSuppressClick = '1';
      suppressTimer=setTimeout(()=>{delete surface.dataset.swipeSuppressClick;},80);
    };

    const setX = (value, animate = false) => {
      currentX = Math.max(-actionWidth(), Math.min(canShare?88:0, value));
      row.classList.toggle('is-sharing',currentX>0);
      surface.classList.toggle('is-animating', animate);
      surface.style.transform = `translate3d(${currentX}px,0,0)`;
      row.classList.toggle('is-actions-open', currentX < -1);
      row.classList.toggle('is-actions-expanded', currentX < -firstWidth() - 8);

      if (currentX >= -1 && openRow === row) openRow = null;
      else if (currentX < -1) openRow = row;
    };

    const close = (animate = true) => setX(0, animate);
    const open = (animate = true) => setX(-firstWidth(), animate);
    const openSecond = (animate = true) => setX(-actionWidth(), animate);

    const pointerDown = event => {
      if (pointerId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      if (openRow && openRow !== row) {
        openRow.dispatchEvent(new CustomEvent('swipe.close'));
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startOffsetX = currentX;
      dragging = false;
      locked = '';
      surface.classList.remove('is-animating');
    };

    const pointerMove = event => {
      if (pointerId !== event.pointerId) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
        locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }

      if (locked !== 'x') return;

      // A closed row only owns leftward swipes. Rightward movement stays
      // available for the module-to-home gesture, matching Log's policy.
      if (startOffsetX === 0 && dx > 0 && !canShare) return;

      if (!dragging) { try { surface.setPointerCapture?.(event.pointerId); } catch {} }
      dragging = true;
      event.preventDefault();
      setX(startOffsetX + dx);
    };

    const pointerUp = event => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      try { surface.releasePointerCapture?.(event.pointerId); } catch {}

      if (!dragging || locked !== 'x') {
        if (locked === 'x' && Math.abs(event.clientX-startX)>OPEN_THRESHOLD_X) suppressClick();
        locked = '';
        dragging = false;
        return;
      }

      const dx = event.clientX - startX;
      if(canShare&&startOffsetX===0&&dx>OPEN_THRESHOLD_X){close(true);suppressClick();locked='';dragging=false;onShare(row.dataset.swipeRow,row);return;}
      if (startOffsetX < 0 && dx > OPEN_THRESHOLD_X * 0.7) {
        close(true);
      } else if (doubleSwipe && dx < -OPEN_THRESHOLD_X && (startOffsetX <= -firstWidth() + 1)) {
        openSecond(true);
      } else if (currentX <= -Math.min(OPEN_THRESHOLD_X, actionWidth() * 0.38)) {
        open(true);
      } else {
        close(true);
      }

      suppressClick();

      locked = '';
      dragging = false;
    };

    const pointerCancel = event => {
      if (pointerId !== event.pointerId) return;
      pointerId=null;dragging=false;locked='';setX(startOffsetX,true);suppressClick();
      try {surface.releasePointerCapture?.(event.pointerId);} catch {}
    };
    listen(surface,'pointerdown',pointerDown);
    listen(surface,'pointermove',pointerMove,{passive:false});
    listen(surface,'pointerup',pointerUp);
    listen(surface,'pointercancel',pointerCancel);

    listen(surface,'click', event => {
      if (surface.dataset.swipeSuppressClick === '1') {
        event.preventDefault();
        return;
      }

      if (currentX !== 0) {
        event.preventDefault();
        close(true);
        return;
      }

      onOpen?.(row.dataset.swipeRow, row);
    });

    listen(edit,'click', () => {
      const id = row.dataset.swipeRow;
      close(false);
      onEdit?.(id, row);
    });

    listen(secondary,'click', () => {
      const id = row.dataset.swipeRow;
      close(false);
      onSecondary?.(id, row);
    });

    listen(remove,'click', () => {
      const id = row.dataset.swipeRow;
      onDelete?.(id, row);
    });

    listen(row,'swipe.close', () => close(true));
    listen(row,'swipe.reset', () => close(true));
    cleanups.push(()=>{
      if(pointerId!==null){try{surface.releasePointerCapture?.(pointerId);}catch{}}
      pointerId=null;clearTimeout(suppressTimer);delete surface.dataset.swipeSuppressClick;close(false);
    });
  }

  const closeAll = event => {
    if (!openRow) return;
    if (event.target.closest('[data-swipe-row]')) return;
    openRow.dispatchEvent(new CustomEvent('swipe.close'));
  };

  listen(container,'pointerdown',closeAll);

  return () => {
    cleanups.splice(0).forEach(cleanup=>cleanup());
  };
}
