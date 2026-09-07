import mongoose from 'mongoose';

/** Resolve sellable line (base product or variant). */
export function resolveProductLine(product, variantId) {
  if (!product) return null;

  const variants = product.variants || [];
  if (variantId && variants.length) {
    const variant = variants.find((v) => v._id?.toString() === String(variantId));
    if (!variant) return null;
    return {
      productId: product._id,
      variantId: variant._id,
      type: variant.type,
      labelAr: variant.valueAr,
      labelEn: variant.valueEn,
      sku: variant.sku || product.sku,
      barcode: variant.barcode || product.barcode,
      price: variant.price ?? product.price,
      wholesalePrice: variant.wholesalePrice ?? product.wholesalePrice ?? 0,
      oldPrice: variant.oldPrice ?? product.oldPrice,
      stock: variant.stock ?? 0,
      reservedStock: variant.reservedStock ?? 0,
      unit: product.unit,
      emoji: product.emoji,
      image: product.images?.[0] || product.emoji,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      slug: product.slug,
    };
  }

  if (variants.length) {
    const def = variants.find((v) => v.isDefault) || variants[0];
    if (def && !variantId) {
      return resolveProductLine(product, def._id);
    }
  }

  return {
    productId: product._id,
    variantId: null,
    type: null,
    labelAr: null,
    labelEn: null,
    sku: product.sku,
    barcode: product.barcode,
    price: product.price,
    wholesalePrice: product.wholesalePrice ?? 0,
    oldPrice: product.oldPrice,
    stock: product.stock ?? 0,
    reservedStock: product.reservedStock ?? 0,
    unit: product.unit,
    emoji: product.emoji,
    image: product.images?.[0] || product.emoji,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    slug: product.slug,
  };
}

export function getAvailableStock(line) {
  if (!line) return 0;
  return Math.max(0, (line.stock ?? 0) - (line.reservedStock ?? 0));
}

export function cartItemKey(productId, variantId) {
  return `${productId}:${variantId || ''}`;
}

export function normalizeVariantId(variantId) {
  if (!variantId) return null;
  if (!mongoose.Types.ObjectId.isValid(variantId)) return null;
  return new mongoose.Types.ObjectId(variantId);
}
