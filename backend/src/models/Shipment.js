import mongoose from 'mongoose';
import { FULFILLMENT_MODES } from '../constants/marketplace.js';

/**
 * Seller-shipped flow. Store-fulfilled shipments mirror the order's own status instead
 * (see syncStoreShipmentsFromOrder), so they only ever use pending → … → delivered/cancelled.
 */
export const SHIPMENT_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

/** Statuses a seller may move a seller-shipped shipment to, from each status. */
export const SELLER_SHIPMENT_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  returned: [],
};

const shipmentItemSchema = new mongoose.Schema(
  {
    /** Index into order.items — the order stays the customer-facing record of the line. */
    itemIndex: { type: Number, required: true, min: 0 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sku: { type: String, trim: true },
    nameAr: { type: String, trim: true },
    nameEn: { type: String, trim: true },
    variantLabelAr: { type: String, trim: true },
    variantLabelEn: { type: String, trim: true },
    image: { type: String },
    price: { type: Number, min: 0, required: true },
    quantity: { type: Number, min: 1, required: true },
    lineTotal: { type: Number, min: 0, required: true },
    /** Snapshot at order time — later commission changes never rewrite past sales. */
    commissionRate: { type: Number, min: 0, max: 100, default: 0 },
    commission: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, trim: true, required: true },
    /** ORDERNUMBER-S1, -S2 … */
    shipmentNumber: { type: String, trim: true, required: true, unique: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    sellerNameAr: { type: String, trim: true, default: '' },
    sellerNameEn: { type: String, trim: true, default: '' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fulfilledBy: { type: String, enum: FULFILLMENT_MODES, required: true },
    items: { type: [shipmentItemSchema], default: [] },

    subtotal: { type: Number, min: 0, default: 0 },
    /** Delivery fee the customer paid for this shipment (seller-shipped only). */
    deliveryFee: { type: Number, min: 0, default: 0 },
    commissionTotal: { type: Number, min: 0, default: 0 },
    /** Store fulfillment fee charged to the seller (store-shipped only). */
    fulfillmentFee: { type: Number, min: 0, default: 0 },
    /** What the seller earns: subtotal + deliveryFee − commission − fulfillmentFee. */
    sellerNet: { type: Number, default: 0 },
    paymentMethod: { type: String, trim: true, default: '' },

    status: { type: String, enum: SHIPMENT_STATUSES, default: 'pending', index: true },
    statusHistory: {
      type: [
        {
          status: { type: String, enum: SHIPMENT_STATUSES, required: true },
          note: { type: String, trim: true, default: '' },
          changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          changedByRole: { type: String, trim: true, default: '' },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    carrier: { type: String, trim: true, default: '' },
    trackingNumber: { type: String, trim: true, default: '' },
    confirmedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: '' },
    cancelledByRole: { type: String, trim: true, default: '' },

    /** Money owed back to the customer when this shipment alone is cancelled. */
    refund: {
      amount: { type: Number, min: 0, default: 0 },
      status: { type: String, enum: ['none', 'reduced_cod', 'wallet', 'gateway', 'manual_required', 'mixed'], default: 'none' },
      note: { type: String, trim: true, default: '' },
    },

    /** Set once the delivered sale is posted to the seller ledger (phase 3). */
    settledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

shipmentSchema.index({ seller: 1, status: 1, createdAt: -1 });
shipmentSchema.index({ seller: 1, createdAt: -1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);

export default Shipment;
