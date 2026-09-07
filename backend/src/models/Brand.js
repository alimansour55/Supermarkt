import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
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
    /** Matches Product.brand for filtering */
    queryValue: {
      type: String,
      required: true,
      trim: true,
    },
    emoji: { type: String, default: '🏷️' },
    logo: { type: String, default: null },
    cloudinaryPublicId: { type: String, default: null },
    descriptionAr: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    website: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

brandSchema.index({ isActive: 1, sortOrder: 1 });
brandSchema.index({ queryValue: 1 });

const Brand = mongoose.model('Brand', brandSchema);

export default Brand;
