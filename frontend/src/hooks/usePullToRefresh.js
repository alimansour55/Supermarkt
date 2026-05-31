import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Simple pull-to-refresh for scrollable lists (mobile).
 */
export function usePullToRefresh(onRefresh, { disabled = false, threshold = 70 } = {}) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useRef(0);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPulling(false);
      pullDistance.current = 0;
    }
  }, [onRefresh]);

  useEffect(() => {
    if (disabled) return undefined;

    const onTouchStart = (e) => {
      if (window.scrollY > 8) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (window.scrollY > 8) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        pullDistance.current = dy;
        setPulling(dy > 20);
      }
    };

    const onTouchEnd = () => {
      if (pullDistance.current >= threshold && !refreshing) {
        runRefresh();
      } else {
        setPulling(false);
        pullDistance.current = 0;
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [disabled, threshold, refreshing, runRefresh]);

  return { pulling, refreshing };
}
