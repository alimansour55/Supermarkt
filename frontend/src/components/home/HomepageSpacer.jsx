const HEIGHTS = { sm: 'h-4', md: 'h-8', lg: 'h-14', xl: 'h-24' };

/** Empty breathing room between sections, with an optional thin line. */
export default function HomepageSpacer({ section }) {
  const cfg = section.blockConfig || {};
  const height = HEIGHTS[cfg.spacerSize] || HEIGHTS.md;
  return (
    <div className={`container-app flex items-center ${height}`} aria-hidden>
      {cfg.showLine && <span className="block h-px w-full bg-border" />}
    </div>
  );
}
