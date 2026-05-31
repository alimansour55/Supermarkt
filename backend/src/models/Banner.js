import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    titleAr: { type: String, trim: true, required: true },
    titleEn: { type: String, trim: true, required: true },
    subtitleAr: { type: String, trim: true },
    subtitleEn: { type: String, trim: true },
    image: { type: String, required: true },
    cloudinaryPublicId: { type: String },
    link: { type: String, trim: true, default: '/offers' },
    placement: {
      type: String,
      enum: ['hero', 'promo', 'sidebar'],
      default: 'hero',
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

bannerSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
