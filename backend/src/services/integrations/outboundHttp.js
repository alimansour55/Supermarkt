/**
 * HTTP calls to addresses an admin typed in (webhook URLs, file URLs, connector hosts).
 * Blocks the server's own private network in production so a typed URL can't be used
 * to reach internal services, and caps time and response size.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 20 * 1024 * 1024;

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

const allowPrivate = () => process.env.NODE_ENV !== 'production' || process.env.INTEGRATIONS_ALLOW_PRIVATE_URLS === 'true';

/** Throws a readable error when the URL is not allowed. */
export async function assertSafeUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl)); } catch { throw new Error('The address is not a valid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http:// and https:// addresses are allowed');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && process.env.INTEGRATIONS_ALLOW_HTTP !== 'true') {
    throw new Error('Use an https:// address');
  }
  if (allowPrivate()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new Error('That address points to a private network and cannot be used');
  }
  return url;
}

/** fetch() with a timeout and a size cap; returns { status, ok, text, buffer, headers }. */
export async function safeFetch(rawUrl, { method = 'GET', headers = {}, body, timeoutMs = 15000, maxBytes = MAX_BYTES } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Follow redirects by hand so every hop is checked (file links on Google Drive/Dropbox redirect).
    let url = await assertSafeUrl(rawUrl);
    let res;
    for (let hop = 0; ; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      res = await fetch(url, { method, headers, body, signal: controller.signal, redirect: 'manual' });
      const location = res.headers.get('location');
      if (res.status < 300 || res.status >= 400 || !location) break;
      if (hop >= 5) throw new Error('Too many redirects');
      // eslint-disable-next-line no-await-in-loop
      url = await assertSafeUrl(new URL(location, url).toString());
    }
    const reader = res.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          controller.abort();
          throw new Error(`Response is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
        }
        chunks.push(value);
      }
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { status: res.status, ok: res.ok, text: buffer.toString('utf8'), buffer, headers: res.headers };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`No answer within ${Math.round(timeoutMs / 1000)} seconds`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}) {
  const res = await safeFetch(url, options);
  let json = null;
  try { json = res.text ? JSON.parse(res.text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const detail = json?.message || json?.error?.message || json?.error || res.text.slice(0, 200);
    const err = new Error(`HTTP ${res.status}${detail ? `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
    err.status = res.status;
    throw err;
  }
  return json;
}
