import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    nameAr: {
      type: String,
      required: [true, 'Arabic name is required'],
      trim: true,
      maxlength: [80, 'Arabic name is too long'],
    },
    nameEn: {
      type: String,
      required: [true, 'English name is required'],
      trim: true,
      maxlength: [80, 'English name is too long'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 60,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens'],
    },
    /** Matches Product.brand for filtering */
    queryValue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    emoji: { type: String, default: '🏷️', trim: true, maxlength: 8 },
    logo: { type: String, default: null },
    cloudinaryPublicId: { type: String, default: null },
    descriptionAr: { type: String, default: '', trim: true, maxlength: 600 },
    descriptionEn: { type: String, default: '', trim: true, maxlength: 600 },
    website: { type: String, default: '', trim: true, maxlength: 200 },
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
