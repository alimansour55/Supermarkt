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
 * One stable vendor chunk for the React core (shared by every page, long-cached).
 * Everything else — app code and the remaining npm packages — splits along
 * route-module / lazy() boundaries, so each page downloads only what it renders.
 *
 * Don't add groups for libraries that depend on React (recharts, react-leaflet,
 * @stripe/react-stripe-js…): Rolldown pulls a group's dependencies into it, so
 * React itself would move into that chunk and every page would download it.
 * A catch-all "vendor" chunk would likewise put admin-only libraries on every page.
 */
function manualChunks(id) {
  if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler|cookie|set-cookie-parser)[\\/]/.test(id)) {
    return 'vendor-react';
  }
  return undefined;
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
