import mongoose from 'mongoose';
import { VARIANT_TYPES } from '../constants/productCatalog.js';
import { resolveProductCategoryFields } from '../utils/productCategorySync.js';

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
    isActive: {
      type: Boolean,
      default: true,
    },
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

const Product = mongoose.model('Product', productSchema);

export default Product;
