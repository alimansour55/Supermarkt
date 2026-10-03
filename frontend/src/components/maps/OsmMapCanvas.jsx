import { Suspense, lazy } from 'react';
import ClientOnly from '../ui/ClientOnly';

// Leaflet touches `window` on import, so the map loads only in the browser.
const LeafletMap = lazy(() => import('./leaflet/OsmMapCanvas'));

export default function OsmMapCanvas(props) {
  const placeholder = (
    <div
      className={`animate-pulse rounded-xl bg-slate-100 ${props.heightClass || 'h-64'}`}
      aria-hidden="true"
    />
  );
  return (
    <ClientOnly fallback={placeholder}>
      {() => (
        <Suspense fallback={placeholder}>
          <LeafletMap {...props} />
        </Suspense>
      )}
    </ClientOnly>
  );
}
