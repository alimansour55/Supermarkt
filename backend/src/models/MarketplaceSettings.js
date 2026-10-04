import mongoose from 'mongoose';
import { DEFAULT_MARKETPLACE_SETTINGS as D } from '../constants/marketplace.js';

const categoryCommissionSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    rate: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false },
);

/** Singleton (key = 'main') — marketplace rules, kept apart from the storefront StoreSettings. */
const marketplaceSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    enabled: { type: Boolean, default: D.enabled },
    registrationOpen: { type: Boolean, default: D.registrationOpen },
    defaultCommissionRate: { type: Number, min: 0, max: 100, default: D.defaultCommissionRate },
    categoryCommissions: { type: [categoryCommissionSchema], default: [] },
    payoutHoldDays: { type: Number, min: 0, max: 90, default: D.payoutHoldDays },
    storeFulfillmentFeePerItem: { type: Number, min: 0, default: D.storeFulfillmentFeePerItem },
    sellerShipmentDeliveryFee: { type: Number, min: 0, default: D.sellerShipmentDeliveryFee },
    reviewContentEdits: { type: Boolean, default: D.reviewContentEdits },
    minPayoutAmount: { type: Number, min: 0, default: D.minPayoutAmount },
    termsAr: { type: String, trim: true, default: '' },
    termsEn: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

const MarketplaceSettings = mongoose.model('MarketplaceSettings', marketplaceSettingsSchema);

export default MarketplaceSettings;
