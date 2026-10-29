// Keep the selected point in the largest area not covered by the board.
export function createBoardMapAlignment(map, coords) {
  let frame = 0;
  return {
    onLayout(plateRect, deckRect) {
      if (!Array.isArray(coords) || coords.length !== 2 || !coords.every(Number.isFinite)) return;
      if (!map?.getContainer || !map?.project || !map?.unproject) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = map.getContainer().getBoundingClientRect();
        const blocked = [plateRect, deckRect].filter(Boolean).map(r => ({
          left: Math.max(0, r.left - rect.left - 8), right: Math.min(rect.width, r.right - rect.left + 8),
          top: Math.max(0, r.top - rect.top - 8), bottom: Math.min(rect.height, r.bottom - rect.top + 8)
        }));
        const step = 24;
        let best = { x:rect.width/2, y:rect.height*.2, score:-Infinity };
        for (let y = step; y < rect.height - step; y += step) {
          for (let x = step; x < rect.width - step; x += step) {
            if (blocked.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
            let clearance = Math.min(x, y, rect.width-x, rect.height-y);
            for (const r of blocked) {
              const dx = Math.max(r.left-x, 0, x-r.right);
              const dy = Math.max(r.top-y, 0, y-r.bottom);
              clearance = Math.min(clearance, Math.hypot(dx, dy));
            }
            const score = clearance - Math.hypot(x-rect.width/2,y-rect.height/2)*.08;
            if (score > best.score) best = {x,y,score};
          }
        }
        const point = map.project(coords);
        const deltaX = best.x - point.x, deltaY = best.y - point.y;
        if (Math.hypot(deltaX,deltaY) > 12) map.easeTo({
          center: map.unproject([rect.width/2 - deltaX, rect.height/2 - deltaY]),
          duration: 480, essential:true
        });
      });
    },
    destroy() { cancelAnimationFrame(frame); }
  };
}
