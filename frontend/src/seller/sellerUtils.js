/** Save an axios blob response (CSV exports). */
export function saveBlob(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] || '';
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Latin digits everywhere, matching formatPrice.
export const fmtNumber = (n) => Number(n || 0).toLocaleString('en-US');

/** Dates in the user's language but always with Latin digits, like prices. */
const locale = (isAr) => (isAr ? 'ar-EG-u-nu-latn' : 'en-GB');
export const fmtDate = (d, isAr) => (d ? new Date(d).toLocaleDateString(locale(isAr), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtDateTime = (d, isAr) => (d ? new Date(d).toLocaleString(locale(isAr), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDay = (d, isAr, opts = { day: 'numeric', month: 'short' }) => new Date(d).toLocaleDateString(locale(isAr), opts);
