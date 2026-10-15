import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FRAME_SOURCE,
  HOST_SOURCE,
  PREVIEW_FRAME_PATH,
  PREVIEW_WIDTHS,
} from '../../utils/homepagePreviewProtocol';

/**
 * The storefront rendered in an <iframe> at a real phone (390px) or desktop
 * (1280px) width, scaled down to fit the column. Media queries inside the frame
 * see the real width, so the phone preview is the actual phone layout.
 *
 * notes: { [sectionId]: { label?, name?, dim? } } — badges drawn over sections.
 */
export default function HomepagePreviewFrame({
  sections,
  device = 'desktop',
  selectedId = null,
  notes = {},
  interactive = true,
  onSelect,
  scrollRequest = null,
  minHeight = 240,
  title = 'Homepage preview',
}) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(0);
  const [contentHeight, setContentHeight] = useState(minHeight);
  const frameWidth = PREVIEW_WIDTHS[device] || PREVIEW_WIDTHS.desktop;

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const measure = () => setAvailable(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const send = useCallback((message) => {
    frameRef.current?.contentWindow?.postMessage({ source: HOST_SOURCE, ...message }, window.location.origin);
  }, []);

  // The latest render payload, so a frame that (re)loads gets it straight away.
  const payloadRef = useRef(null);
  useLayoutEffect(() => {
    payloadRef.current = { type: 'render', sections, selectedId, notes, interactive };
  });

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== FRAME_SOURCE) return;
      if (data.type === 'ready') {
        setReady(true);
        send(payloadRef.current);
      }
      if (data.type === 'height' && Number.isFinite(data.height)) setContentHeight(Math.max(minHeight, data.height));
      if (data.type === 'select' && data.id) onSelect?.(data.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [minHeight, onSelect, send]);

  useEffect(() => {
    if (ready) send({ type: 'render', sections, selectedId, notes, interactive });
  }, [ready, sections, selectedId, notes, interactive, send]);

  useEffect(() => {
    if (ready && scrollRequest?.id) send({ type: 'scrollTo', id: scrollRequest.id });
  }, [ready, scrollRequest, send]);

  const isMobile = device === 'mobile';
  const chrome = isMobile ? 12 : 2; // the frame's border, both sides
  const scale = available ? Math.min(1, Math.max(0.1, (available - chrome) / frameWidth)) : 1;

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className={[
          'relative mx-auto overflow-hidden bg-white transition-[width]',
          isMobile ? 'rounded-[1.75rem] border-[6px] border-slate-800 shadow-xl' : 'rounded-xl border border-slate-300 shadow-lg',
        ].join(' ')}
        style={{
          width: frameWidth * scale + chrome,
          height: contentHeight * scale + chrome,
        }}
      >
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        )}
        <iframe
          ref={frameRef}
          title={title}
          src={PREVIEW_FRAME_PATH}
          className="absolute left-0 top-0 block border-0"
          style={{
            width: frameWidth,
            height: contentHeight,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        />
      </div>
    </div>
  );
}
