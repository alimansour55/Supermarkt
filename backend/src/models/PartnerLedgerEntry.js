import mongoose from 'mongoose';

/** Manual money movements that sit outside the generated payout flow. */
export const PARTNER_LEDGER_TYPES = [
  'bonus',
  'deduction',
  'correction',
  'opening_balance',
  'advance',
  'reimbursement',
];

/** Signed direction each type applies to the partner balance. */
export const PARTNER_LEDGER_SIGN = {
  bonus: 1,
  correction: 1,
  opening_balance: 1,
  reimbursement: 1,
  deduction: -1,
  advance: -1,
};

const partnerLedgerEntrySchema = new mongoose.Schema(
  {
    /** Matches partnerRevenue.partners[].userId (as string) or the partner subdocument _id. */
    partnerKey: { type: String, required: true, trim: true, index: true },
    partnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partnerNameAr: { type: String, trim: true, default: '' },
    partnerNameEn: { type: String, trim: true, default: '' },

    type: { type: String, enum: PARTNER_LEDGER_TYPES, required: true },
    /** Always stored as an absolute value; direction comes from `type` via PARTNER_LEDGER_SIGN. */
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, default: 'EGP' },

    dateKey: { type: String, trim: true, default: '' },
    periodStartKey: { type: String, trim: true, default: '' },
    periodEndKey: { type: String, trim: true, default: '' },

    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

partnerLedgerEntrySchema.index({ partnerKey: 1, dateKey: -1 });
partnerLedgerEntrySchema.index({ partnerKey: 1, createdAt: -1 });

/** Signed effect on the partner balance (positive = owed to partner). */
partnerLedgerEntrySchema.virtual('signedAmount').get(function signedAmount() {
  return (PARTNER_LEDGER_SIGN[this.type] || 1) * (this.amount || 0);
});

const PartnerLedgerEntry = mongoose.model('PartnerLedgerEntry', partnerLedgerEntrySchema);

export default PartnerLedgerEntry;
