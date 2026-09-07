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

export function pickCategoryImage(category) {
  if (!category?.image) return null;
  return isImageUrl(category.image) ? category.image : null;
}
