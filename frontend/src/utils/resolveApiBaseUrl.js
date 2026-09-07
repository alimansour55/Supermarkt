const LAN_HOST_RE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function isLanHostname(hostname) {
  return LAN_HOST_RE.test(hostname || '');
}

/**
 * Default API base URL — always same-origin /api in dev (Vite proxy on :5173).
 * This matches how mobile access worked when opening http://192.168.x.x:5173/
 */
export function resolveApiBaseUrl() {
  const fromEnv = (import.meta.env.VITE_API_URL || '/api').trim();

  if (typeof window === 'undefined') {
    return fromEnv.replace(/\/$/, '') || '/api';
  }

  const { hostname, protocol } = window.location;

  if (fromEnv.startsWith('/')) {
    return fromEnv.replace(/\/$/, '') || '/api';
  }

  try {
    const parsed = new URL(fromEnv, window.location.origin);
    const envIsLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isPageLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (envIsLocalhost && !isPageLocalhost) {
      return `${protocol}//${hostname}:${parsed.port || '5001'}/api`;
    }

    return parsed.pathname.startsWith('/api')
      ? `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
      : fromEnv.replace(/\/$/, '');
  } catch {
    return '/api';
  }
}

export function getApiCandidates() {
  if (typeof window === 'undefined') return [resolveApiBaseUrl()];

  const { hostname, protocol, port } = window.location;
  const frontendPort = port || '5173';
  const apiPort = String(import.meta.env.VITE_API_PORT || '5001').trim();
  const proxied = `${protocol}//${hostname}:${frontendPort}/api`;
  const direct = `${protocol}//${hostname}:${apiPort}/api`;

  const candidates = ['/api', proxied];
  if (isLanHostname(hostname)) {
    candidates.push(direct);
  } else if (!hostname.includes('localhost') && hostname !== '127.0.0.1') {
    candidates.push(direct);
  }

  return [...new Set(candidates)];
}

export function getAlternateApiBaseUrl(currentBaseUrl) {
  const candidates = getApiCandidates();
  const normalized = currentBaseUrl?.replace(/\/$/, '') || '/api';
  return candidates.find((candidate) => candidate.replace(/\/$/, '') !== normalized) || null;
}

export function buildHealthUrl(baseUrl) {
  const base = baseUrl.replace(/\/$/, '') || '/api';
  if (base.startsWith('http')) return `${base}/health`;
  if (typeof window !== 'undefined') return `${window.location.origin}${base}/health`;
  return `${base}/health`;
}

/**
 * Pick the first reachable API base (proxy first, then direct :5001 on LAN).
 */
export async function probeApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return resolveApiBaseUrl();
    }
  }

  const candidates = getApiCandidates();

  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(buildHealthUrl(candidate), {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      if (res.ok) return candidate.replace(/\/$/, '') || '/api';
    } catch {
      // try next candidate
    }
  }

  return resolveApiBaseUrl();
}
