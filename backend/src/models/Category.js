import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
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
    image: {
      type: String,
      default: null,
    },
    cloudinaryPublicId: {
      type: String,
      default: null,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    /** 1 = main, 2 = category, 3 = sub, 4 = sub-sub (products attach to leaf nodes) */
    level: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    icon: { type: String, default: '🛒' },
    color: { type: String, default: 'bg-primary-50' },
    sortOrder: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

categorySchema.index({ parentCategory: 1, isActive: 1 });

categorySchema.pre('save', async function setLevel(next) {
  try {
    if (!this.parentCategory) {
      this.level = 1;
      return next();
    }
    const parent = await mongoose.model('Category').findById(this.parentCategory).select('level');
    if (!parent) return next(new Error('Parent category not found'));
    this.level = Math.min((parent.level || 1) + 1, 4);
    return next();
  } catch (err) {
    return next(err);
  }
});

const Category = mongoose.model('Category', categorySchema);

export default Category;
