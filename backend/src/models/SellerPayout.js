import mongoose from 'mongoose';

export const SELLER_PAYOUT_STATUSES = ['pending', 'paid', 'cancelled'];
export const SELLER_PAYOUT_METHODS = ['bank_transfer', 'wallet', 'cash', 'instapay', 'other'];

/**
 * A transfer to a seller. Generating it locks the available ledger entries it covers;
 * marking it paid posts the matching `payout` debit; cancelling releases the entries.
 */
const sellerPayoutSchema = new mongoose.Schema(
  {
    payoutNumber: { type: String, trim: true, required: true, unique: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    sellerNameAr: { type: String, trim: true, default: '' },
    sellerNameEn: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true, min: 0 },
    entryCount: { type: Number, min: 0, default: 0 },
    /** Covers entries that became available up to this moment. */
    periodEnd: { type: Date, required: true },
    bankSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: SELLER_PAYOUT_STATUSES, default: 'pending', index: true },
    method: { type: String, enum: [...SELLER_PAYOUT_METHODS, ''], default: '' },
    referenceNumber: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

sellerPayoutSchema.index({ seller: 1, createdAt: -1 });

const SellerPayout = mongoose.model('SellerPayout', sellerPayoutSchema);

export default SellerPayout;
