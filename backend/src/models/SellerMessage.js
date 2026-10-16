import mongoose from 'mongoose';

export const SELLER_MESSAGE_KINDS = ['message', 'warning', 'notice'];
export const WARNING_REASONS = ['late_shipping', 'cancellations', 'quality', 'counterfeit', 'policy', 'customer_service', 'other'];

/**
 * One line in the store ↔ seller conversation: staff messages, formal warnings (optionally a
 * strike toward suspension), automatic health notices, and the seller's replies. Kept for good
 * so both sides can see what was said and when.
 */
const sellerMessageSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    /** staff → seller, or the seller's reply. */
    from: { type: String, enum: ['staff', 'seller', 'system'], required: true },
    kind: { type: String, enum: SELLER_MESSAGE_KINDS, default: 'message' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    authorName: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, required: true, maxlength: 4000 },
    /** Warnings only. */
    reason: { type: String, enum: [...WARNING_REASONS, ''], default: '' },
    strike: { type: Boolean, default: false },
    /** A withdrawn strike stays visible but no longer counts. */
    withdrawnAt: { type: Date, default: null },
    withdrawnBy: { type: String, trim: true, default: '' },
    /** When the other side first read it. */
    sellerReadAt: { type: Date, default: null },
    staffReadAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sellerMessageSchema.index({ seller: 1, createdAt: -1 });
sellerMessageSchema.index({ seller: 1, kind: 1, strike: 1, createdAt: -1 });
sellerMessageSchema.index({ from: 1, staffReadAt: 1 });

const SellerMessage = mongoose.model('SellerMessage', sellerMessageSchema);

export default SellerMessage;
