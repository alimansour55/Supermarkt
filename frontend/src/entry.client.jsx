import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { warmStorefront } from './utils/warmStorefront';
import { clearChunkRetryFlags } from './app/lazyWithRetry';

// Server-rendered pages already carry their data; only the static Capacitor
// build needs to warm the critical storefront APIs up front.
if (window.__reactRouterContext?.isSpaMode) warmStorefront();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});

// Once a session has stayed up for a few seconds, any earlier chunk-load retry
// clearly succeeded — drop the flags so a future stale chunk can retry again.
setTimeout(clearChunkRetryFlags, 5000);
