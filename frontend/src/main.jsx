import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { warmStorefront } from './utils/warmStorefront';
import { clearChunkRetryFlags } from './app/lazyWithRetry';

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

warmStorefront();

// Once a session has stayed up for a few seconds, any earlier chunk-load retry
// clearly succeeded — drop the flags so a future stale chunk can retry again.
setTimeout(clearChunkRetryFlags, 5000);
