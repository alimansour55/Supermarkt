import { useEffect, useState } from 'react';

/**
 * Height of the sticky admin header (it grows when a page has tabs), so other
 * sticky bars can sit right under it instead of sliding beneath it.
 */
export default function useAdminHeaderHeight(fallback = 64) {
  const [height, setHeight] = useState(fallback);

  useEffect(() => {
    const header = document.querySelector('header.sticky');
    if (!header) return undefined;
    const measure = () => setHeight(Math.round(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return height;
}
