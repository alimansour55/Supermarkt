import mongoose from 'mongoose';

export const WALLET_TOPUP_METHODS = ['instapay', 'vodafone_cash'];
export const WALLET_TOPUP_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * A customer request to load money into their wallet by manual bank transfer
 * (InstaPay) or Vodafone Cash. The customer transfers the amount to one of the
 * store's configured accounts and uploads a screenshot; an admin verifies it and
 * approves — approval credits the wallet and links the `WalletTransaction` here.
 */
const walletTopUpRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    method: {
      type: String,
      enum: WALLET_TOPUP_METHODS,
      required: true,
    },
    /** The store account the customer says they transferred to. */
    destinationAccount: {
      type: String,
      trim: true,
      default: '',
    },
    /** Optional: the phone / account the customer transferred *from*. */
    senderReference: {
      type: String,
      trim: true,
      default: '',
    },
    proofUrl: {
      type: String,
      trim: true,
      default: '',
    },
    proofPublicId: {
      type: String,
      trim: true,
      default: '',
    },
    proofUploadedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: WALLET_TOPUP_STATUSES,
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    walletTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      default: null,
    },
  },
  { timestamps: true },
);

walletTopUpRequestSchema.index({ status: 1, createdAt: -1 });
walletTopUpRequestSchema.index({ user: 1, createdAt: -1 });

const WalletTopUpRequest = mongoose.model('WalletTopUpRequest', walletTopUpRequestSchema);

export default WalletTopUpRequest;
