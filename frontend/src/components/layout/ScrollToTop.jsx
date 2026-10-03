import { useEffect, useRef } from 'react';
import { useLocation } from '../../app/router';
import { scrollToTop } from '../../utils/scrollToTop';

/**
 * Scroll to top only when navigating to a different route (pathname).
 * Query-only updates (filters, sort, pagination) keep the user's scroll position.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    scrollToTop('instant');
    const t = requestAnimationFrame(() => scrollToTop('instant'));
    return () => cancelAnimationFrame(t);
  }, [pathname]);

  return null;
}
