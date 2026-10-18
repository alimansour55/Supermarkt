import { useEffect } from 'react';

/**
 * Fixed bars pinned to the bottom of phone screens publish their live height as
 * CSS variables on <html>, so everything else can stack above them instead of
 * guessing pixel offsets:
 *   --tabbar-h      the bottom tab bar (0 when hidden, e.g. on md+ or checkout)
 *   --action-bar-h  a page's sticky action bar (add to cart, checkout total)
 * Consumers: <main> bottom padding, the action bars' own `bottom`, the chat bubble.
 * Defaults live in index.css so the server-rendered page is already close.
 *
 * @param {'--tabbar-h'|'--action-bar-h'} varName
 * @param {{ current: HTMLElement|null }} ref  the bar element (display:none measures 0)
 * @param {boolean} [active=true]  false when the bar is not rendered at all
 */
export function useBottomChromeHeight(varName, ref, active = true) {
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!active || !el) {
      root.style.setProperty(varName, '0px');
      return undefined;
    }
    const update = () => root.style.setProperty(varName, `${el.offsetHeight}px`);
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      root.style.setProperty(varName, '0px');
    };
  }, [varName, ref, active]);
}
