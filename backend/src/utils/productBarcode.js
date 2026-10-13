import Product from '../models/Product.js';
import { AppError } from './AppError.js';

/** Trimmed barcode, or undefined when empty (so it is not stored as ""). */
export function normalizeBarcode(barcode) {
  if (barcode == null) return undefined;
  const trimmed = String(barcode).trim();
  return trimmed || undefined;
}

/** The product (other than `excludeProductId`) already using this barcode, if any. */
export async function findBarcodeOwner(barcode, excludeProductId) {
  const value = normalizeBarcode(barcode);
  if (!value) return null;
  const filter = { $or: [{ barcode: value }, { 'variants.barcode': value }] };
  if (excludeProductId) filter._id = { $ne: excludeProductId };
  return Product.findOne(filter).select('_id nameAr nameEn').lean();
}

export async function assertBarcodeAvailable(barcode, excludeProductId) {
  const owner = await findBarcodeOwner(barcode, excludeProductId);
  if (owner) {
    throw new AppError(`Barcode already used by "${owner.nameEn || owner.nameAr}"`, 409);
  }
}
