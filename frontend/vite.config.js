import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { formatLanUrls } from '../scripts/lan-address.mjs';

const FRONTEND_PORT = 5173;

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

export default defineConfig({
  plugins: [react(), tailwindcss(), printMobileUrls()],
  build: {
    rollupOptions: {
      output: {
        // Only group node_modules into stable vendor chunks. Application code is
        // left to split automatically along the lazy() / dynamic-import route
        // boundaries defined in src/app/lazyRoutes.js and lazyAdminRoutes.js —
        // forcing it into single "admin"/"storefront" chunks (as before) merged
        // ~220 admin files into one 2.2 MB download and defeated code-splitting.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
            return 'vendor-react';
          }
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('leaflet')) return 'vendor-maps';
          if (id.includes('@stripe')) return 'vendor-stripe';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    // No custom hmr.host — Vite uses the page hostname (192.168.x.x on phone).
    // A fixed hmr host was breaking mobile reload / page load.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
