import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { formatLanUrls } from '../scripts/lan-address.mjs';

const FRONTEND_PORT = 5173;
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:5001';

function printMobileUrls() {
  return {
    name: 'print-mobile-urls',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const urls = formatLanUrls(FRONTEND_PORT);
        console.log('\n--- Mobile / same Wi‑Fi ---');
        if (urls.length) {
          console.log('Open on your phone:');
          urls.forEach((url) => console.log(`  → ${url}`));
        } else {
          console.log('Could not detect LAN IP. Run ipconfig, then:');
          console.log(`  http://<your-ipv4>:${FRONTEND_PORT}`);
        }
        console.log('Phone and laptop must be on the same Wi‑Fi.');
        console.log('If blocked, run: npm run setup:mobile');
        console.log('----------------------------\n');
      });
    },
  };
}

/**
 * Only group node_modules into stable vendor chunks. Application code is left to
 * split automatically along route-module boundaries (src/routes.js) and the
 * lazy() admin pages — forcing it into single "admin"/"storefront" chunks merged
 * ~220 admin files into one 2.2 MB download and defeated code-splitting.
 */
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
    return 'vendor-react';
  }
  if (id.includes('lucide-react')) return 'vendor-icons';
  if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
  if (id.includes('leaflet')) return 'vendor-maps';
  if (id.includes('@stripe')) return 'vendor-stripe';
  return 'vendor';
}

const apiProxy = {
  '/api': {
    target: API_PROXY_TARGET,
    changeOrigin: true,
    secure: false,
  },
};

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), printMobileUrls()],
  // Pre-bundle the heavy libs that are only reached through lazy() admin routes.
  // Without this, Vite discovers them mid-session on first navigation, re-optimizes,
  // and the already-loaded page requests a now-stale dep hash -> 504 "Outdated
  // Optimize Dep" and a failed dynamic import (e.g. DashboardPage / recharts).
  optimizeDeps: {
    include: [
      'recharts',
      'leaflet',
      'react-leaflet',
      '@vis.gl/react-google-maps',
      '@stripe/stripe-js',
      '@stripe/react-stripe-js',
    ],
  },
  // Vendor chunking applies to the browser bundle only, not the SSR server build.
  environments: {
    client: { build: { rollupOptions: { output: { manualChunks } } } },
  },
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    // No custom hmr.host — Vite uses the page hostname (192.168.x.x on phone).
    // A fixed hmr host was breaking mobile reload / page load.
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    proxy: apiProxy,
  },
});
