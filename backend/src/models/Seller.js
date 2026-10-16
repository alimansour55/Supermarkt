import mongoose from 'mongoose';
import geoFields from '../schemas/geoFields.js';
import { SELLER_STATUSES, SELLER_DOCUMENT_TYPES, FULFILLMENT_MODES } from '../constants/marketplace.js';

const sellerDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SELLER_DOCUMENT_TYPES, required: true },
    /** Public URL — only for legacy documents; new uploads are private (see `private`). */
    url: { type: String, trim: true, default: '' },
    publicId: { type: String, trim: true, default: '' },
    format: { type: String, trim: true, default: '' },
    /** Stored as an authenticated Cloudinary asset; served via short-lived signed links. */
    private: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    note: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const categoryCommissionSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    rate: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false },
);

/**
 * A deal change staff scheduled for later ("15% from 1 November"). `changes` holds only deal
 * fields (commissionRate, categoryCommissions, feePlan, feeOverrides) — already validated.
 */
const scheduledDealSchema = new mongoose.Schema(
  {
    applyAt: { type: Date, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    note: { type: String, trim: true, default: '', maxlength: 300 },
    status: { type: String, enum: ['pending', 'applied', 'cancelled'], default: 'pending' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
    doneAt: { type: Date, default: null },
  },
  { _id: true },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: SELLER_STATUSES, required: true },
    reason: { type: String, trim: true, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const sellerSchema = new mongoose.Schema(
  {
    nameAr: { type: String, trim: true, required: true, maxlength: 120 },
    nameEn: { type: String, trim: true, required: true, maxlength: 120 },
    slug: { type: String, trim: true, lowercase: true, required: true, unique: true },
    descriptionAr: { type: String, trim: true, default: '', maxlength: 2000 },
    descriptionEn: { type: String, trim: true, default: '', maxlength: 2000 },
    logoUrl: { type: String, trim: true, default: '' },
    logoPublicId: { type: String, trim: true, default: '' },
    bannerUrl: { type: String, trim: true, default: '' },
    bannerPublicId: { type: String, trim: true, default: '' },

    /** Legal identity (private — staff and the seller only). */
    legalName: { type: String, trim: true, default: '' },
    commercialRegisterNo: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    contactName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },

    /** Pickup / return address for seller-shipped orders. */
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      governorate: { type: String, trim: true, default: '' },
      ...geoFields,
    },

    /** Bank details for payouts (private — never on public endpoints). */
    bank: {
      bankName: { type: String, trim: true, default: '' },
      accountName: { type: String, trim: true, default: '' },
      accountNumber: { type: String, trim: true, default: '' },
      iban: { type: String, trim: true, default: '' },
      walletPhone: { type: String, trim: true, default: '' },
    },

    documents: { type: [sellerDocumentSchema], default: [] },

    status: { type: String, enum: SELLER_STATUSES, default: 'applied', index: true },
    statusReason: { type: String, trim: true, default: '' },
    statusHistory: { type: [statusHistorySchema], default: [] },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /** null = marketplace default. */
    commissionRate: { type: Number, min: 0, max: 100, default: null },
    categoryCommissions: { type: [categoryCommissionSchema], default: [] },
    /** Fee plan key from MarketplaceSettings.plans ('' = the default plan). */
    feePlan: { type: String, trim: true, default: '' },
    /** Seller-specific deal terms; null = inherit the plan / marketplace value. */
    feeOverrides: {
      minCommissionPerItem: { type: Number, min: 0, default: null },
      maxCommissionPerItem: { type: Number, min: 0, default: null },
      fixedFeePerItem: { type: Number, min: 0, default: null },
      fixedFeePerShipment: { type: Number, min: 0, default: null },
      storeFulfillmentFeePerItem: { type: Number, min: 0, default: null },
      monthlyFee: { type: Number, min: 0, default: null },
      payoutHoldDays: { type: Number, min: 0, max: 90, default: null },
      /** No commission on sales until this date (onboarding offer). */
      commissionFreeUntil: { type: Date, default: null },
      vatExempt: { type: Boolean, default: false },
      /** '' = marketplace schedule; 'manual' keeps this seller out of automatic payouts. */
      payoutFrequency: { type: String, enum: ['', 'manual', 'weekly', 'biweekly', 'monthly'], default: '' },
    },

    /** Deal changes waiting for their date (applied by the seller jobs runner). */
    scheduledDeals: { type: [scheduledDealSchema], default: [] },

    /** Fulfillment modes this seller may use on its products. */
    allowedFulfillment: {
      type: [{ type: String, enum: FULFILLMENT_MODES }],
      default: ['seller'],
    },
    defaultFulfillment: { type: String, enum: FULFILLMENT_MODES, default: 'seller' },
    /** Zones the seller ships to itself (empty = all active zones). */
    deliveryZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone' }],
    /** Typical handling time before a seller-shipped order leaves, in days. */
    handlingDays: { type: Number, min: 0, max: 30, default: 2 },
    /** Store page design: tagline, banner slider and hand-picked featured products. */
    storefront: {
      taglineAr: { type: String, trim: true, default: '', maxlength: 160 },
      taglineEn: { type: String, trim: true, default: '', maxlength: 160 },
      banners: {
        type: [{
          _id: false,
          url: { type: String, trim: true, required: true },
          publicId: { type: String, trim: true, default: '' },
          link: { type: String, trim: true, default: '' },
        }],
        default: [],
      },
      featuredProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    },
    /** Vacation mode: every listing is hidden until the seller returns (or `until` passes). */
    vacation: {
      enabled: { type: Boolean, default: false },
      startedAt: { type: Date, default: null },
      until: { type: Date, default: null },
      messageAr: { type: String, trim: true, default: '', maxlength: 300 },
      messageEn: { type: String, trim: true, default: '', maxlength: 300 },
    },
    /** How the seller wants to hear about orders and stock (in-app notifications are always on). */
    notificationPrefs: {
      emailOrders: { type: Boolean, default: true },
      whatsappOrders: { type: Boolean, default: false },
      emailLowStock: { type: Boolean, default: true },
      shipByReminders: { type: Boolean, default: true },
    },
    /** Approved sellers can publish listings without staff review. */
    autoApproveListings: { type: Boolean, default: false },

    intendedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    applicationNote: { type: String, trim: true, default: '', maxlength: 2000 },
    termsAcceptedAt: { type: Date, default: null },
    internalNote: { type: String, trim: true, default: '', maxlength: 4000 },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    rating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

sellerSchema.index({ status: 1, createdAt: -1 });
sellerSchema.index({ 'scheduledDeals.status': 1, 'scheduledDeals.applyAt': 1 });

const Seller = mongoose.model('Seller', sellerSchema);

export default Seller;
