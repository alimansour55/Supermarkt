/**
 * Share & earn: remember whose link brought this shopper (?ref=CODE) so checkout can
 * credit them. Last link wins; the memory lasts the program's attribution window
 * (sent back by the server when the click is recorded).
 */
const KEY = 'mp_affiliate_ref';
const SESSION_KEY = 'mp_affiliate_ref_seen';
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;

export const normalizeRefCode = (value) => String(value || '').trim().toUpperCase();
export const isRefCode = (value) => CODE_RE.test(normalizeRefCode(value));

export function readAffiliateRef(now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const ref = JSON.parse(raw);
    if (!ref?.code || !ref.expiresAt || ref.expiresAt < now) {
      localStorage.removeItem(KEY);
      return null;
    }
    return ref.code;
  } catch {
    return null;
  }
}

export function saveAffiliateRef(code, attributionDays = 7, now = Date.now()) {
  try {
    const days = Math.max(1, Number(attributionDays) || 7);
    localStorage.setItem(KEY, JSON.stringify({ code: normalizeRefCode(code), expiresAt: now + days * 86400000 }));
  } catch {
    // storage blocked — the link simply isn't remembered
  }
}

export function clearAffiliateRef() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** True the first time this code is seen in this browser tab session (counts one click). */
export function markRefSeen(code) {
  try {
    const seen = sessionStorage.getItem(SESSION_KEY);
    if (seen === normalizeRefCode(code)) return false;
    sessionStorage.setItem(SESSION_KEY, normalizeRefCode(code));
  } catch {
    // ignore
  }
  return true;
}

/** Add ?ref=CODE to any link on this site (keeps other query params and the hash). */
export function withAffiliateRef(url, code) {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    u.searchParams.set('ref', normalizeRefCode(code));
    return u.toString();
  } catch {
    return url;
  }
}
