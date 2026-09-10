import mongoose from 'mongoose';

/** Every movement of a customer's store-wallet balance, newest-first by createdAt. */
export const WALLET_TRANSACTION_TYPES = ['topup', 'spend', 'refund', 'adjust', 'reversal'];

export const WALLET_TRANSACTION_METHODS = [
  'instapay',
  'vodafone_cash',
  'admin',
  'order',
  'system',
];

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: WALLET_TRANSACTION_TYPES,
      required: true,
    },
    /** Signed: positive = credit into the wallet, negative = debit out of it. */
    amount: {
      type: Number,
      required: true,
    },
    /** Wallet balance immediately after this transaction was applied. */
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    topUpRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTopUpRequest',
      default: null,
    },
    method: {
      type: String,
      enum: WALLET_TRANSACTION_METHODS,
      default: 'system',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    /** Admin who performed a manual adjust / approve; null for automatic movements. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;
