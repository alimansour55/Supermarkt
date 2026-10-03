// Phone browsers (iOS Safari/Chrome, Android Chrome) only expose navigator.geolocation on a
// "secure context": https://, or http://localhost on the machine actually running the page.
// The plain `npm run dev` LAN URL (http://192.168.x.x:5173) fails that check on a phone, so
// "Use my location" always fails there with a permission-denied-style error — no app code can
// change that, it's a browser/OS security rule. This spins up a local HTTPS proxy in front of
// the existing Vite dev server (which keeps running on plain http://localhost:5173, unchanged)
// so the phone can open an https:// LAN URL instead and actually get a secure context.
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { formatLanUrls } from './lan-address.mjs';

const TARGET_PORT = 5173;
const SOURCE_PORT = 5174;

console.log('\n--- Mobile HTTPS (needed for GPS / "Use my location" testing) ---');
const urls = formatLanUrls(SOURCE_PORT, { protocol: 'https' });
if (urls.length) {
  console.log('Open on your phone (same Wi-Fi):');
  urls.forEach((url) => console.log(`  -> ${url}`));
  console.log('First visit: the browser will warn about the certificate (it is self-signed,');
  console.log('for local dev only) — tap "Advanced" / "Show Details" then "proceed" once.');
} else {
  console.log(`Could not detect LAN IP. Run ipconfig, then use https://<your-ipv4>:${SOURCE_PORT}`);
}
console.log(`Note: http://<ip>:${TARGET_PORT} still works for everything except geolocation.`);
console.log('-------------------------------------------------------------------\n');

// Run local-ssl-proxy's own entry file straight through `node`, rather than shelling out to
// `npx`/`npx.cmd` — spawning a .cmd directly without a shell fails with EINVAL on Windows,
// and adding `shell: true` back would just reopen that (already-fixed) footgun.
const proxyBin = fileURLToPath(new URL('../node_modules/local-ssl-proxy/build/main.js', import.meta.url));
if (!existsSync(proxyBin)) {
  console.error('local-ssl-proxy is not installed. Run: npm install');
  process.exit(1);
}

const proxy = spawn(
  process.execPath,
  [proxyBin, '--source', String(SOURCE_PORT), '--target', String(TARGET_PORT)],
  { stdio: 'inherit' },
);

proxy.on('exit', (code) => process.exit(code ?? 0));
