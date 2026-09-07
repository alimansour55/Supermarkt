let scrollRestorationSet = false;

/** Prevent the browser from restoring scroll position on back/forward navigation. */
export function ensureManualScrollRestoration() {
  if (scrollRestorationSet || typeof window === 'undefined') return;
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  scrollRestorationSet = true;
}

/** Scroll window and optional in-app scroll containers to top. */
export function scrollToTop(behavior = 'instant') {
  ensureManualScrollRestoration();

  const run = () => {
    const opts = { top: 0, left: 0, behavior };
    window.scrollTo(opts);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    document.querySelectorAll('[data-scroll-root]').forEach((el) => {
      el.scrollTop = 0;
    });
  };

  run();
  requestAnimationFrame(run);
}

/**
 * Scroll so a section sits just below the sticky header (uses scroll-margin on target).
 * @param {string} elementId
 * @param {ScrollBehavior} behavior
 */
export function scrollToSection(elementId, behavior = 'smooth') {
  ensureManualScrollRestoration();

  const run = () => {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
  };

  requestAnimationFrame(() => requestAnimationFrame(run));
}
