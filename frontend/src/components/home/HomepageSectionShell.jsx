import { sectionShellProps } from '../../utils/homepageVisibility';

/**
 * Wraps one homepage section with its device rule, spacing, background and
 * anchor. Renders the section bare when none of those are set.
 */
export default function HomepageSectionShell({ section, children }) {
  const shell = sectionShellProps(section);
  if (!shell) return children;

  const { outer, box, overlay, contained } = shell;
  if (!box) {
    return <div id={outer.id} className={outer.className || undefined}>{children}</div>;
  }

  const inner = (
    <div className={box.className} style={box.style}>
      {overlay && <div className={`pointer-events-none absolute inset-0 ${overlay}`} aria-hidden />}
      <div className="relative">{children}</div>
    </div>
  );

  return (
    <div id={outer.id} className={outer.className || undefined}>
      {contained ? <div className="container-app">{inner}</div> : inner}
    </div>
  );
}
