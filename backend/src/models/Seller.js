import mongoose from 'mongoose';
import geoFields from '../schemas/geoFields.js';
import { SELLER_STATUSES, SELLER_DOCUMENT_TYPES, FULFILLMENT_MODES } from '../constants/marketplace.js';

const sellerDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SELLER_DOCUMENT_TYPES, required: true },
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, default: '' },
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

const Seller = mongoose.model('Seller', sellerSchema);

export default Seller;
