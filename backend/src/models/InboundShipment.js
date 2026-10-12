import mongoose from 'mongoose';

export const INBOUND_STATUSES = ['pending', 'received', 'cancelled'];

/**
 * A seller sending stock of its store-fulfilled products to the store's warehouse. Staff count
 * what arrived; only received quantities become sellable stock.
 */
const inboundItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    nameAr: { type: String, trim: true },
    nameEn: { type: String, trim: true },
    variantLabelAr: { type: String, trim: true, default: '' },
    variantLabelEn: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true },
    quantity: { type: Number, min: 1, required: true },
    receivedQuantity: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const inboundShipmentSchema = new mongoose.Schema(
  {
    inboundNumber: { type: String, trim: true, required: true, unique: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    sellerNameAr: { type: String, trim: true, default: '' },
    sellerNameEn: { type: String, trim: true, default: '' },
    fulfillmentLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation', default: null },
    items: { type: [inboundItemSchema], default: [] },
    status: { type: String, enum: INBOUND_STATUSES, default: 'pending', index: true },
    expectedAt: { type: Date, default: null },
    carrier: { type: String, trim: true, default: '' },
    trackingNumber: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    receivedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receiveNote: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inboundShipmentSchema.index({ status: 1, createdAt: -1 });

const InboundShipment = mongoose.model('InboundShipment', inboundShipmentSchema);

export default InboundShipment;
