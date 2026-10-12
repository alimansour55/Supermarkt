import mongoose from 'mongoose';

/**
 * Append-only seller money ledger. A seller's balance is the sum of its entries — there is no
 * stored balance to drift. Positive = the marketplace owes the seller.
 */
export const SELLER_LEDGER_TYPES = [
  'sale', // + line totals of a delivered shipment
  'delivery_fee', // + delivery fee the customer paid for a seller-shipped shipment
  'commission', // − marketplace commission
  'fulfillment_fee', // − store fulfillment fee (store-shipped seller items)
  'cod_collected', // − cash the seller collected from the customer itself
  'return', // − refunded line value of a returned item
  'commission_reversal', // + commission given back on a returned item
  'adjustment', // ± manual correction by staff
  'payout', // − money transferred to the seller
];

const sellerLedgerEntrySchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    type: { type: String, enum: SELLER_LEDGER_TYPES, required: true },
    /** Signed amount in EGP. */
    amount: { type: Number, required: true },
    /** When the entry becomes payable (delivery + hold period). */
    availableAt: { type: Date, required: true, default: Date.now },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    reference: { type: String, trim: true, default: '' },
    /** Payout this entry was settled in (set when the payout is generated). */
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerPayout', default: null, index: true },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Idempotency key — the same business event can never be posted twice. */
    key: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

sellerLedgerEntrySchema.index({ seller: 1, createdAt: -1 });
sellerLedgerEntrySchema.index({ seller: 1, payout: 1, availableAt: 1 });

const SellerLedgerEntry = mongoose.model('SellerLedgerEntry', sellerLedgerEntrySchema);

export default SellerLedgerEntry;
