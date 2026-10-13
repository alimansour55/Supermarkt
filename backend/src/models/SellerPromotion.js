import mongoose from 'mongoose';

export const SELLER_PROMOTION_STATUSES = ['pending', 'approved', 'active', 'ended', 'rejected', 'cancelled'];

/**
 * A seller-funded discount ("10% off Honey section, 1–7 March"). Staff approve it; while
 * active it is applied as a price markdown (oldPrice = was, price = discounted) on every
 * product in scope, and the previous prices are restored when it ends. The seller pays for
 * it simply by selling for less.
 */
const appliedSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    price: { type: Number, required: true },
    oldPrice: { type: Number, default: null },
    variants: [{ _id: false, variant: mongoose.Schema.Types.ObjectId, price: Number, oldPrice: Number }],
  },
  { _id: false },
);

const sellerPromotionSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    name: { type: String, trim: true, required: true, maxlength: 120 },
    percent: { type: Number, required: true, min: 5, max: 70 },
    scope: { type: String, enum: ['all', 'sections', 'products'], default: 'all' },
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SellerCategory' }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: SELLER_PROMOTION_STATUSES, default: 'pending', index: true },
    reviewNote: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Snapshot of what was changed, so ending restores exactly the previous prices. */
    applied: { type: [appliedSchema], default: [] },
    activatedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    /** Products skipped because another promotion already discounted them. */
    skipped: { type: Number, default: 0 },
  },
  { timestamps: true },
);

sellerPromotionSchema.index({ status: 1, startsAt: 1 });
sellerPromotionSchema.index({ status: 1, endsAt: 1 });

const SellerPromotion = mongoose.model('SellerPromotion', sellerPromotionSchema);

export default SellerPromotion;
