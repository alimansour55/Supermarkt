import mongoose from 'mongoose';

export const PARTNER_PAYOUT_STATUSES = ['pending', 'paid', 'cancelled'];

export const PARTNER_PAYOUT_METHODS = ['bank_transfer', 'cash', 'wallet', 'cheque', 'other'];

const partnerPayoutSchema = new mongoose.Schema(
  {
    /** Matches partnerRevenue.partners[].userId (as string) or the partner subdocument _id. */
    partnerKey: { type: String, required: true, trim: true, index: true },
    partnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partnerNameAr: { type: String, trim: true, default: '' },
    partnerNameEn: { type: String, trim: true, default: '' },
    partnerEmail: { type: String, trim: true, default: '' },
    partnerPhone: { type: String, trim: true, default: '' },

    periodStartKey: { type: String, trim: true, default: '' },
    periodEndKey: { type: String, trim: true, default: '' },
    periodLabel: { type: String, trim: true, default: '' },

    amount: { type: Number, required: true, min: 0 },
    sharePercent: { type: Number, default: null },
    distributionMode: { type: String, trim: true, default: '' },
    currency: { type: String, trim: true, default: 'EGP' },

    status: { type: String, enum: PARTNER_PAYOUT_STATUSES, default: 'pending', index: true },
    paymentMethod: { type: String, enum: [...PARTNER_PAYOUT_METHODS, ''], default: '' },
    referenceNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },

    source: { type: String, enum: ['generated', 'manual'], default: 'manual' },
    reportSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

partnerPayoutSchema.index({ partnerKey: 1, periodStartKey: 1, periodEndKey: 1 });
partnerPayoutSchema.index({ status: 1, createdAt: -1 });

const PartnerPayout = mongoose.model('PartnerPayout', partnerPayoutSchema);

export default PartnerPayout;
