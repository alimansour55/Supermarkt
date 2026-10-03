/**
 * React Router framework config.
 *
 * - Default build: server-rendered site (public pages are SSR'd for SEO) → build/
 * - BUILD_TARGET=spa: static single-page build for the Capacitor mobile app → build-spa/client
 *   (route modules with a server `loader` get a client-only variant via `spaVariant()` in routes.js)
 */
const isSpa = process.env.BUILD_TARGET === 'spa';

export default {
  appDirectory: 'src',
  ssr: !isSpa,
  buildDirectory: isSpa ? 'build-spa' : 'build',
  // Opt in to the v8 behaviours now so the eventual v8 upgrade is a no-op.
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
};
