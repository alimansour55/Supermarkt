import mongoose from 'mongoose';

/** Emails collected by the homepage "Sign up" block. One row per address. */
const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      maxlength: 254,
    },
    language: { type: String, enum: ['ar', 'en'], default: 'ar' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, trim: true, default: 'homepage' },
    /** The homepage section the form was in, when known. */
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'HomepageSection', default: null },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

newsletterSubscriberSchema.index({ createdAt: -1 });

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);

export default NewsletterSubscriber;
