import mongoose from 'mongoose';

export const DRIVER_CASH_TYPES = ['collect', 'handover', 'adjust'];

/**
 * Ledger of cash a driver holds for the store. `amount` is signed: a COD collection
 * is positive, a handover to the store is negative. `balanceAfter` is the driver's
 * `driverCashBalance` right after this entry.
 */
const driverCashLedgerSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: DRIVER_CASH_TYPES, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

driverCashLedgerSchema.index({ driver: 1, createdAt: -1 });
// One collection entry per order, so a retried completion can never double-count cash.
driverCashLedgerSchema.index(
  { order: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'collect' } },
);

const DriverCashLedger = mongoose.model('DriverCashLedger', driverCashLedgerSchema);

export default DriverCashLedger;
