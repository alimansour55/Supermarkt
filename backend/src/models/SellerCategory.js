import mongoose from 'mongoose';

/**
 * A seller's own store sections ("Honey", "Gift boxes" …) — independent of the marketplace
 * category tree. Sellers group their products with them, and customers filter the seller's
 * store page by them. Two levels at most: a section may have one parent.
 */
const sellerCategorySchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    nameAr: { type: String, trim: true, required: true, maxlength: 80 },
    nameEn: { type: String, trim: true, required: true, maxlength: 80 },
    slug: { type: String, trim: true, lowercase: true, required: true, maxlength: 100 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerCategory', default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sellerCategorySchema.index({ seller: 1, slug: 1 }, { unique: true });
sellerCategorySchema.index({ seller: 1, parent: 1, sortOrder: 1 });

const SellerCategory = mongoose.model('SellerCategory', sellerCategorySchema);

export default SellerCategory;
