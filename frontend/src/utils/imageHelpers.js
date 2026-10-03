export function isVideoUrl(src) {
  if (typeof src !== 'string') return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(src) || src.includes('/video/upload/');
}

export function isImageUrl(src) {
  return typeof src === 'string'
    && (src.startsWith('http') || src.startsWith('/'))
    && !isVideoUrl(src);
}

export function pickProductImage(product) {
  if (!product) return null;
  if (product.image && isImageUrl(product.image)) return product.image;

  const images = product.images || [];
  const types = product.mediaTypes || [];
  for (let i = 0; i < images.length; i += 1) {
    const src = images[i]?.url || images[i];
    if (types[i] === 'video') continue;
    if (isImageUrl(src)) return src;
  }
  return null;
}

// Seed/catalog data often stores a single emoji as the "image" placeholder.
// Detect those so we can render them instead of a generic broken-image icon.
export function isEmojiImage(src) {
  return typeof src === 'string'
    && src.trim().length > 0
    && src.trim().length <= 8
    && !isImageUrl(src)
    && !isVideoUrl(src)
    && /\p{Extended_Pictographic}/u.test(src);
}

export function pickProductEmoji(product) {
  if (!product) return null;
  if (isEmojiImage(product.image)) return product.image.trim();
  const images = product.images || [];
  for (let i = 0; i < images.length; i += 1) {
    const src = images[i]?.url || images[i];
    if (isEmojiImage(src)) return src.trim();
  }
  return null;
}

export function pickCategoryImage(category) {
  if (!category?.image) return null;
  return isImageUrl(category.image) ? category.image : null;
}
