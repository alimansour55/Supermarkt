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
    /**
     * Materialized path — ordered root → immediate parent.
     * Maintained by the pre-save hook and rebuildDescendantPaths() on reparent.
     * A product's listing for a category matches `{ categoryAncestors: <id> }`.
     */
    ancestors: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
    },
    /** Distance from the root (root = 0). Equals ancestors.length. Display/sort only. */
    depth: {
      type: Number,
      default: 0,
      index: true,
    },
    /**
     * @deprecated Use `depth` (depth + 1). Kept written for backward compatibility
     * while the storefront/admin migrate off the fixed 1–4 level model.
     */
    level: {
      type: Number,
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
categorySchema.index({ ancestors: 1 });

categorySchema.pre('save', async function setPath(next) {
  try {
    if (!this.isModified('parentCategory') && !this.isNew) return next();

    if (!this.parentCategory) {
      this.ancestors = [];
      this.depth = 0;
      this.level = 1;
      return next();
    }

    const parent = await mongoose.model('Category')
      .findById(this.parentCategory)
      .select('ancestors parentCategory');
    if (!parent) return next(new Error('Parent category not found'));

    const parentAncestors = Array.isArray(parent.ancestors) && parent.ancestors.length
      ? parent.ancestors
      : (parent.parentCategory ? [parent.parentCategory] : []);

    this.ancestors = [...parentAncestors, parent._id];
    this.depth = this.ancestors.length;
    this.level = this.depth + 1;
    return next();
  } catch (err) {
    return next(err);
  }
});

const Category = mongoose.model('Category', categorySchema);

export default Category;
