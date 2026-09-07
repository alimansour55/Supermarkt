import mongoose from 'mongoose';
import { PROMOTION_TYPES, PROMOTION_TARGET_MODES } from '../constants/promotionTypes.js';

const promotionRulesSchema = new mongoose.Schema(
  {
    percent: { type: Number, min: 1, max: 99, default: 10 },
    amountOff: { type: Number, min: 0, default: 0 },
    fixedPrice: { type: Number, min: 0, default: 0 },
    buyQty: { type: Number, min: 1, default: 1 },
    getQty: { type: Number, min: 1, default: 1 },
    getProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    sameProduct: { type: Boolean, default: true },
    secondPercentOff: { type: Number, min: 1, max: 100, default: 50 },
    bundlePrice: { type: Number, min: 0, default: 0 },
    bundleProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    minPurchaseQty: { type: Number, min: 1, default: 1 },
    promotionUnit: {
      type: String,
      enum: ['pieces', 'weight_kg', 'weight_l'],
      default: 'pieces',
    },
  },
  { _id: false },
);

const promotionSchema = new mongoose.Schema(
  {
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    type: {
      type: String,
      enum: PROMOTION_TYPES.map((t) => t.value),
      default: 'percent_off',
    },
    targetMode: {
      type: String,
      enum: PROMOTION_TARGET_MODES.map((t) => t.value),
      default: 'products',
    },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    brandSlugs: [{ type: String, trim: true, lowercase: true }],
    rules: { type: promotionRulesSchema, default: () => ({}) },
    badgeAr: { type: String, trim: true, default: 'عرض' },
    badgeEn: { type: String, trim: true, default: 'Offer' },
    cartLineAr: { type: String, trim: true, default: '' },
    cartLineEn: { type: String, trim: true, default: '' },
    cartProgressAr: { type: String, trim: true, default: '' },
    cartProgressEn: { type: String, trim: true, default: '' },
    cartSubtextAr: { type: String, trim: true, default: '' },
    cartSubtextEn: { type: String, trim: true, default: '' },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: '' },
    source: {
      type: String,
      enum: ['admin', 'homepage'],
      default: 'admin',
    },
    homepageSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HomepageSection',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

promotionSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });
promotionSchema.index({ type: 1 });
promotionSchema.index({ homepageSectionId: 1 });

promotionSchema.methods.resolveStatus = function resolveStatus(now = new Date()) {
  if (!this.isActive) return 'paused';
  if (this.startsAt && now < new Date(this.startsAt)) return 'scheduled';
  if (this.endsAt && now > new Date(this.endsAt)) return 'ended';
  if (this.usageLimit && this.usedCount >= this.usageLimit) return 'ended';
  return 'active';
};

const Promotion = mongoose.model('Promotion', promotionSchema);

export default Promotion;
