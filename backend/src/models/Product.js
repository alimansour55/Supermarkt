import mongoose from 'mongoose';
import { VARIANT_TYPES } from '../constants/productCatalog.js';
import { FULFILLMENT_MODES, LISTING_STATUSES } from '../constants/marketplace.js';
import { resolveProductCategoryFields } from '../utils/productCategorySync.js';
import {
  SEARCH_INDEXED_FIELDS,
  scheduleProductSync,
  scheduleFullSync,
} from '../services/searchIndex.service.js';

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'hidden', 'rejected'],
      default: 'pending',
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    verifiedPurchaseManual: {
      type: Boolean,
      default: null,
    },
    pinned: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    reReviewAllowed: { type: Boolean, default: false },
    reReviewGrantedAt: { type: Date, default: null },
    reReviewGrantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    images: [{
      url: { type: String, trim: true },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    }],
    reports: [{
      reason: {
        type: String,
        enum: ['spam', 'offensive', 'fake', 'wrong_product', 'duplicate'],
      },
      reportedAt: { type: Date, default: Date.now },
      reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    }],
    reportedCount: { type: Number, min: 0, default: 0 },
    internalNote: { type: String, trim: true, maxlength: 2000, default: '' },
    adminReply: {
      message: { type: String, trim: true, maxlength: 2000, default: '' },
      repliedAt: { type: Date, default: null },
      repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
  },
  { timestamps: true },
);

const productVariantSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: VARIANT_TYPES,
      required: true,
    },
    valueAr: { type: String, trim: true, required: true },
    valueEn: { type: String, trim: true, required: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    price: { type: Number, min: 0 },
    wholesalePrice: { type: Number, min: 0, default: 0 },
    oldPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, min: 0, default: 0 },
    reservedStock: { type: Number, min: 0, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const productSpecSchema = new mongoose.Schema(
  {
    keyAr: { type: String, trim: true },
    keyEn: { type: String, trim: true },
    valueAr: { type: String, trim: true },
    valueEn: { type: String, trim: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    nameAr: {
      type: String,
      required: [true, 'Arabic name is required'],
      trim: true,
    },
    nameEn: {
      type: String,
      required: [true, 'English name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    descriptionAr: { type: String, trim: true },
    descriptionEn: { type: String, trim: true },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Cost / wholesale price (سعر الجملة) — used for profit reports */
    wholesalePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    oldPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    /**
     * Ordered category path (root → assigned category) maintained from `category`.
     * A category's product listing matches `{ categoryAncestors: <categoryId> }`,
     * covering products attached to that category or any of its descendants.
     */
    categoryAncestors: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      index: true,
    },
    brandAr: {
      type: String,
      trim: true,
      default: '',
    },
    brandEn: {
      type: String,
      trim: true,
      default: '',
    },
    size: {
      type: String,
      trim: true,
      default: '',
    },
    unitAr: {
      type: String,
      trim: true,
      default: '',
    },
    unitEn: {
      type: String,
      trim: true,
      default: '',
    },
    searchKeywordsAr: {
      type: [String],
      default: [],
    },
    searchKeywordsEn: {
      type: [String],
      default: [],
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    variants: {
      type: [productVariantSchema],
      default: [],
    },
    specs: {
      type: [productSpecSchema],
      default: [],
    },
    frequentlyBoughtTogether: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    similarProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    /**
     * How the storefront "Similar products" strip is populated:
     *  - 'auto'   : admin picks shown first, then auto-filled with relevant in-stock products
     *  - 'manual' : only the admin picks are shown (no auto-fill)
     *  - 'off'    : the strip is hidden for this product
     */
    similarMode: {
      type: String,
      enum: ['auto', 'manual', 'off'],
      default: 'auto',
    },
    stockUpdatedAt: {
      type: Date,
      default: null,
    },
    stockHistory: {
      type: [
        {
          previousStock: { type: Number, required: true },
          stock: { type: Number, required: true },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    unit: {
      type: String,
      default: 'piece',
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    cloudinaryPublicIds: {
      type: [String],
      default: [],
    },
    /** Parallel to images — 'image' or 'video' for each entry */
    mediaTypes: {
      type: [String],
      enum: ['image', 'video'],
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: [reviewSchema],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isOffer: {
      type: Boolean,
      default: false,
    },
    offerActive: {
      type: Boolean,
      default: true,
    },
    activePromotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
    },
    promotionType: {
      type: String,
      trim: true,
      default: null,
    },
    offerBadgeAr: { type: String, trim: true, default: null },
    offerBadgeEn: { type: String, trim: true, default: null },
    promotionBuyQty: { type: Number, default: null, min: 1 },
    promotionGetQty: { type: Number, default: null, min: 1 },
    promotionUnit: {
      type: String,
      enum: ['pieces', 'weight_kg', 'weight_l'],
      default: null,
    },
    promotionSecondPercentOff: { type: Number, default: null, min: 1, max: 100 },
    promotionCartLineAr: { type: String, trim: true, default: null },
    promotionCartLineEn: { type: String, trim: true, default: null },
    promotionCartProgressAr: { type: String, trim: true, default: null },
    promotionCartProgressEn: { type: String, trim: true, default: null },
    promotionCartSubtextAr: { type: String, trim: true, default: null },
    promotionCartSubtextEn: { type: String, trim: true, default: null },
    prePromotionPrice: { type: Number, default: null, min: 0 },
    prePromotionOldPrice: { type: Number, default: null, min: 0 },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    /** Store-owned / house brand product — used by "Our products" customer filter */
    isOurProduct: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    /** Public visibility. For seller products this is derived — see enforceSellerListingVisibility. */
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Marketplace ──
    /** Third-party seller that owns this listing; null = sold by the store itself. */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
      index: true,
    },
    /** Who packs and delivers it: the store's fulfillment, or the seller. */
    fulfilledBy: {
      type: String,
      enum: FULFILLMENT_MODES,
      default: 'store',
    },
    listingStatus: {
      type: String,
      enum: LISTING_STATUSES,
      default: 'approved',
      index: true,
    },
    /** Mirror of the seller's suspension, so visibility needs no join. */
    sellerSuspended: { type: Boolean, default: false },
    reviewNote: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Seller content edits to a live listing, waiting for staff approval. */
    pendingChanges: { type: mongoose.Schema.Types.Mixed, default: null },
    pendingChangesAt: { type: Date, default: null },
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    emoji: {
      type: String,
      default: '🛍️',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

async function syncProductCategoryFields(doc) {
  const fields = await resolveProductCategoryFields({
    mainCategory: doc.mainCategory,
    category: doc.category,
  });
  doc.mainCategory = fields.mainCategory;
  doc.category = fields.category;
  doc.categoryAncestors = fields.categoryAncestors;
}

productSchema.pre('validate', async function enforceCategoryIntegrity() {
  const categoryTouched = this.isNew
    || this.isModified('category')
    || this.isModified('mainCategory');
  if (!categoryTouched) return;
  await syncProductCategoryFields(this);
});

/**
 * A seller listing is public only while approved and its seller isn't suspended — whatever
 * a caller wrote to `isActive`. Store-owned products keep their manual `isActive` toggle.
 */
export function sellerListingIsVisible(doc) {
  return doc.listingStatus === 'approved' && !doc.sellerSuspended;
}

productSchema.pre('validate', function enforceSellerListingVisibility(next) {
  if (this.seller) this.isActive = sellerListingIsVisible(this);
  next();
});

productSchema.pre('save', function computeDiscount(next) {
  if (this.oldPrice && this.oldPrice > this.price) {
    this.discount = Math.round(((this.oldPrice - this.price) / this.oldPrice) * 100);
    this.isOffer = this.discount > 0 || !!this.activePromotionId;
  } else {
    this.discount = 0;
    this.isOffer = !!this.activePromotionId;
  }
  next();
});

productSchema.virtual('inStock').get(function inStock() {
  if (this.variants?.length) {
    return this.variants.some((v) => (v.stock || 0) - (v.reservedStock || 0) > 0);
  }
  return (this.stock || 0) - (this.reservedStock || 0) > 0;
});

productSchema.virtual('availableStock').get(function availableStock() {
  if (this.variants?.length) {
    return this.variants.reduce(
      (sum, v) => sum + Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
      0,
    );
  }
  return Math.max(0, (this.stock || 0) - (this.reservedStock || 0));
});

productSchema.index({ nameAr: 'text', nameEn: 'text', brand: 'text', searchKeywordsAr: 'text', searchKeywordsEn: 'text' });
productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ isOffer: 1, isFeatured: 1, isBestSeller: 1 });
productSchema.index({ activePromotionId: 1 });
productSchema.index({ discount: -1 });
productSchema.index({ seller: 1, listingStatus: 1, updatedAt: -1 });
productSchema.index({ listingStatus: 1, submittedAt: 1 });
productSchema.index({ pendingChangesAt: 1 }, { partialFilterExpression: { pendingChangesAt: { $type: 'date' } } });

async function syncCategoryFieldsOnQueryUpdate(next) {
  const update = this.getUpdate();
  if (!update) return next();

  const $set = update.$set || update;
  const categoryTouched = ['mainCategory', 'category'].some(
    (key) => $set[key] !== undefined || update[key] !== undefined,
  );
  if (!categoryTouched) return next();

  try {
    const existing = await this.model.findOne(this.getQuery()).select('mainCategory category').lean();
    const incoming = {
      mainCategory: $set.mainCategory ?? update.mainCategory,
      category: $set.category ?? update.category,
    };
    const fields = await resolveProductCategoryFields({
      mainCategory: incoming.mainCategory ?? existing?.mainCategory,
      category: incoming.category ?? existing?.category,
    });

    if (update.$set) {
      Object.assign(update.$set, fields);
    } else {
      Object.assign(update, fields);
    }
    next();
  } catch (err) {
    next(err);
  }
}

productSchema.pre('findOneAndUpdate', syncCategoryFieldsOnQueryUpdate);
productSchema.pre('updateOne', syncCategoryFieldsOnQueryUpdate);
productSchema.pre('updateMany', syncCategoryFieldsOnQueryUpdate);

// ── Search engine sync: re-index products whose searchable fields change ──

/** Top-level field names an update writes, across operators ($set, $inc, …) and plain keys. */
function updatedFieldNames(update) {
  const names = new Set();
  for (const [key, value] of Object.entries(update || {})) {
    if (key.startsWith('$') && value && typeof value === 'object') {
      Object.keys(value).forEach((field) => names.add(field.split('.')[0]));
    } else {
      names.add(key.split('.')[0]);
    }
  }
  return names;
}

function touchesSearchFields(update) {
  const names = updatedFieldNames(update);
  return SEARCH_INDEXED_FIELDS.some((field) => names.has(field));
}

/** Product ids named directly by a query filter (`_id: x` or `_id: { $in: [...] }`), else null. */
function idsFromFilter(filter) {
  const id = filter?._id;
  if (!id) return null;
  if (Array.isArray(id.$in)) return id.$in;
  if (typeof id === 'string' || mongoose.Types.ObjectId.isValid(id)) return [id];
  return null;
}

productSchema.pre('save', function flagSearchDirty(next) {
  this.$locals.searchDirty = this.isNew || SEARCH_INDEXED_FIELDS.some((field) => this.isModified(field));
  next();
});
productSchema.post('save', (doc) => {
  if (doc.$locals.searchDirty) scheduleProductSync(doc._id);
});
productSchema.post('insertMany', (docs) => {
  scheduleProductSync((docs || []).map((doc) => doc._id));
});

productSchema.pre(['findOneAndUpdate', 'updateOne'], async function captureSearchSyncId() {
  if (!touchesSearchFields(this.getUpdate())) return;
  const ids = idsFromFilter(this.getFilter());
  if (ids) {
    this._searchSyncIds = ids;
    return;
  }
  const doc = await this.model.findOne(this.getFilter()).select('_id').lean();
  this._searchSyncIds = doc ? [doc._id] : [];
});
productSchema.post(['findOneAndUpdate', 'updateOne'], function syncAfterQueryUpdate(result) {
  if (!this._searchSyncIds) return;
  scheduleProductSync([...this._searchSyncIds, result?._id].filter(Boolean));
});
productSchema.post('updateMany', function syncAfterBulkUpdate() {
  if (!touchesSearchFields(this.getUpdate())) return;
  const ids = idsFromFilter(this.getFilter());
  if (ids) scheduleProductSync(ids);
  else scheduleFullSync();
});

productSchema.post('findOneAndDelete', (doc) => {
  if (doc) scheduleProductSync(doc._id);
});
productSchema.post('deleteOne', { document: true, query: false }, (doc) => {
  scheduleProductSync(doc._id);
});
productSchema.post('deleteOne', { document: false, query: true }, function syncAfterQueryDelete() {
  const ids = idsFromFilter(this.getFilter());
  if (ids) scheduleProductSync(ids);
  else scheduleFullSync();
});
productSchema.post('deleteMany', function syncAfterBulkDelete() {
  const ids = idsFromFilter(this.getFilter());
  if (ids) scheduleProductSync(ids);
  else scheduleFullSync();
});

const Product = mongoose.model('Product', productSchema);

export default Product;
