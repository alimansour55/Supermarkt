import mongoose from 'mongoose';

/**
 * A shopper session saw the trending chips on this day (one row per session per day).
 * The denominator for trending-chip CTR in search analytics; rows expire after 180 days.
 */
const trendingImpressionSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    sessionId: { type: String, required: true, trim: true, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

trendingImpressionSchema.index({ day: 1, sessionId: 1 }, { unique: true });
trendingImpressionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const TrendingImpression = mongoose.model('TrendingImpression', trendingImpressionSchema);

export default TrendingImpression;
