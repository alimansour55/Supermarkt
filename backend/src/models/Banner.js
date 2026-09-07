import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    titleAr: { type: String, trim: true, required: true },
    titleEn: { type: String, trim: true, required: true },
    subtitleAr: { type: String, trim: true },
    subtitleEn: { type: String, trim: true },
    image: { type: String, required: true },
    cloudinaryPublicId: { type: String },
    desktopImage: { type: String, trim: true, default: '' },
    desktopCloudinaryPublicId: { type: String, trim: true, default: '' },
    mobileImage: { type: String, trim: true, default: '' },
    mobileCloudinaryPublicId: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '/offers' },
    ctaAr: { type: String, trim: true, default: 'تسوق الآن' },
    ctaEn: { type: String, trim: true, default: 'Shop Now' },
    placement: {
      type: String,
      enum: ['hero', 'promo', 'sidebar'],
      default: 'hero',
    },
    targetAudience: {
      type: String,
      enum: ['all', 'guests', 'customers', 'staff'],
      default: 'all',
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    priority: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

bannerSchema.index({ placement: 1, isActive: 1, priority: -1, sortOrder: 1 });
bannerSchema.index({ startsAt: 1, endsAt: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
