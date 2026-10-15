import { useEffect, useRef, useState } from 'react';
import HomepageSectionRenderer from '../../components/home/HomepageSectionRenderer';
import HomepageSectionShell from '../../components/home/HomepageSectionShell';
import { FRAME_SOURCE, HOST_SOURCE } from '../utils/homepagePreviewProtocol';

/**
 * Inside the builder's preview <iframe>: renders the storefront sections the
 * builder sends, at the iframe's own width — so phone previews use the real
 * phone layout. Reports its height and which section was clicked.
 * Only accepts messages from the admin window on the same origin.
 */
export default function HomepagePreviewFramePage() {
  const [state, setState] = useState({ sections: [], selectedId: null, interactive: true, notes: {} });
  const rootRef = useRef(null);

  const post = (message) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: FRAME_SOURCE, ...message }, window.location.origin);
    }
  };

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.source !== HOST_SOURCE) return;
      if (data.type === 'render') {
        setState({
          sections: Array.isArray(data.sections) ? data.sections : [],
          selectedId: data.selectedId || null,
          interactive: data.interactive !== false,
          notes: data.notes || {},
        });
      }
      if (data.type === 'scrollTo' && data.id) {
        document.querySelector(`[data-section-id="${CSS.escape(String(data.id))}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Tell the builder how tall the page is, so it can size the iframe (no inner scrollbar).
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    let last = 0;
    const report = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        post({ type: 'height', height });
      }
    };
    const observer = new ResizeObserver(report);
    observer.observe(node);
    report();
    return () => observer.disconnect();
  }, []);

  // The admin language lives on <html>; keep the page plain white like the store.
  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.body.style.overflow = 'hidden';
  }, []);

  const { sections, selectedId, interactive, notes } = state;

  return (
    <div ref={rootRef} className="min-h-[200px] bg-white pb-6">
      {sections.length === 0 && (
        <div className="flex h-48 items-center justify-center text-sm text-slate-400">…</div>
      )}
      {sections.map((section) => {
        const note = notes[section._id];
        const selected = selectedId === section._id;
        return (
          <div
            key={section._id}
            data-section-id={section._id}
            className={[
              'group/hp relative',
              interactive ? 'cursor-pointer' : '',
            ].join(' ')}
            onClick={interactive ? () => post({ type: 'select', id: section._id }) : undefined}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter') post({ type: 'select', id: section._id }); } : undefined}
          >
            <div className={['pointer-events-none select-none', note?.dim ? 'opacity-40 grayscale' : ''].join(' ')}>
              {/* Device rules are shown by the builder, not applied — every section stays visible here. */}
              <HomepageSectionShell section={{ ...section, showOnMobile: true, visibility: { ...(section.visibility || {}), devices: 'all' } }}>
                <HomepageSectionRenderer section={section} />
              </HomepageSectionShell>
            </div>
            {interactive && (
              <div
                className={[
                  'pointer-events-none absolute inset-0 z-30 border-2 transition',
                  selected ? 'border-primary-500' : 'border-transparent group-hover/hp:border-primary-300',
                ].join(' ')}
              />
            )}
            {(note?.label || (interactive && selected)) && (
              <div className="pointer-events-none absolute start-2 top-2 z-40 flex flex-wrap gap-1">
                {note?.label && (
                  <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                    {note.label}
                  </span>
                )}
              </div>
            )}
            {interactive && note?.name && (
              <div className="pointer-events-none absolute end-2 top-2 z-40 hidden rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-bold text-white shadow group-hover/hp:block">
                {note.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
