import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_CLOSE_MS = 420;

/**
 * Stable hover menu — avoids flicker from short delays and gap between trigger/panel.
 */
export function useHoverMenu({ closeDelay = DEFAULT_CLOSE_MS } = {}) {
  const openRef = useRef(false);
  const closeTimerRef = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback((onClose) => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      openRef.current = false;
      onClose?.();
    }, closeDelay);
  }, [clearCloseTimer, closeDelay]);

  const cancelClose = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const markOpen = useCallback(() => {
    openRef.current = true;
    clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return {
    cancelClose,
    scheduleClose,
    markOpen,
    isOpenRef: openRef,
  };
}

export default useHoverMenu;
