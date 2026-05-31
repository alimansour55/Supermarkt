import { useRef, useEffect } from 'react';

/**
 * Close a panel when the user swipes it toward the screen edge (drawer dismiss).
 * Attach listeners to `panelRef` only.
 */
export function useSwipeToClose(panelRef, enabled, onClose, { threshold = 72 } = {}) {
  const startX = useRef(0);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || !enabled) return undefined;

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      startX.current = e.touches[0].clientX;
    };

    const onTouchEnd = (e) => {
      const endX = e.changedTouches[0]?.clientX ?? startX.current;
      const delta = endX - startX.current;
      const rtl = document.documentElement.dir === 'rtl';
      const towardClose = rtl ? delta > threshold : delta < -threshold;
      if (towardClose) onClose();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [panelRef, enabled, onClose, threshold]);
}
