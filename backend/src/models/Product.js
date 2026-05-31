import mongoose from 'mongoose';

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
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
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
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    brand: {
      type: String,
      trim: true,
      index: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
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

productSchema.pre('save', function computeDiscount(next) {
  if (this.oldPrice && this.oldPrice > this.price) {
    this.discount = Math.round(((this.oldPrice - this.price) / this.oldPrice) * 100);
    this.isOffer = this.isOffer || this.discount > 0;
  } else {
    this.discount = 0;
  }
  next();
});

productSchema.virtual('inStock').get(function inStock() {
  return this.stock > 0;
});

productSchema.index({ nameAr: 'text', nameEn: 'text', brand: 'text' });
productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ isOffer: 1, isFeatured: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;
