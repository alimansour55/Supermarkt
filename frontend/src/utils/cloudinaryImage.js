/**
 * Cloudinary delivery helpers — serve images resized to the slot they fill, in the best
 * format the browser supports (AVIF/WebP) and an automatically chosen quality.
 * Non-Cloudinary URLs are returned unchanged.
 */
const UPLOAD_SEGMENT = '/image/upload/';
const DEFAULT_WIDTHS = [160, 320, 480, 640, 960, 1280, 1600];

export function isCloudinaryImage(src) {
  return typeof src === 'string' && src.includes('res.cloudinary.com') && src.includes(UPLOAD_SEGMENT);
}

/**
 * @param {string} src
 * @param {{ width?: number, height?: number, crop?: string }} [options]
 */
export function cloudinaryUrl(src, { width, height, crop = 'limit' } = {}) {
  if (!isCloudinaryImage(src)) return src;
  const [base, rest] = src.split(UPLOAD_SEGMENT);
  // Already transformed (first path segment holds transformations, e.g. "w_400,c_fill")?
  if (/^[a-z]{1,3}_[^/]+\//.test(rest) && !/^v\d+\//.test(rest)) return src;
  const parts = ['f_auto', 'q_auto'];
  if (width) parts.push(`w_${Math.round(width)}`);
  if (height) parts.push(`h_${Math.round(height)}`);
  if (width || height) parts.push(`c_${crop}`);
  return `${base}${UPLOAD_SEGMENT}${parts.join(',')}/${rest}`;
}

/** srcset with width descriptors, capped at `maxWidth`. */
export function cloudinarySrcSet(src, { maxWidth = 1600, widths = DEFAULT_WIDTHS } = {}) {
  if (!isCloudinaryImage(src)) return undefined;
  return widths
    .filter((width) => width <= maxWidth)
    .map((width) => `${cloudinaryUrl(src, { width })} ${width}w`)
    .join(', ');
}
