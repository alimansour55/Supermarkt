import mongoose from 'mongoose';

/** A customer's rating of a seller, once per delivered shipment. */
const sellerReviewSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, trim: true, default: '' },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    /** Staff can hide abusive reviews; hidden reviews don't count toward the rating. */
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
  },
  { timestamps: true },
);

sellerReviewSchema.index({ seller: 1, status: 1, createdAt: -1 });

const SellerReview = mongoose.model('SellerReview', sellerReviewSchema);

export default SellerReview;
