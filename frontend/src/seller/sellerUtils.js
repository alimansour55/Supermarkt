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
