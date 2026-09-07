import mongoose from 'mongoose';
import { CONTENT_PAGE_SLUGS } from '../constants/contentPages.js';

const contentSectionSchema = new mongoose.Schema(
  {
    headingAr: { type: String, trim: true, default: '' },
    headingEn: { type: String, trim: true, default: '' },
    bodyAr: { type: String, trim: true, default: '' },
    bodyEn: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true },
);

const contentPageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      enum: CONTENT_PAGE_SLUGS,
      index: true,
    },
    titleAr: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    seoTitleAr: { type: String, trim: true, default: '' },
    seoTitleEn: { type: String, trim: true, default: '' },
    seoDescriptionAr: { type: String, trim: true, default: '' },
    seoDescriptionEn: { type: String, trim: true, default: '' },
    sections: { type: [contentSectionSchema], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const ContentPage = mongoose.model('ContentPage', contentPageSchema);

export default ContentPage;
