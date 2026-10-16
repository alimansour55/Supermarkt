import mongoose from 'mongoose';

/**
 * Stock of one product (or variant) at one branch, as reported by an outside system.
 * Product.stock of a synced product is rebuilt from these rows
 * (see services/integrations/stockSync.service.js).
 */
const locationStockSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    /** null = the whole store (used while the store has no branches set up). */
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation', default: null },
    quantity: { type: Number, default: 0 },
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationConnection', default: null },
    reportedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

locationStockSchema.index({ product: 1, variantId: 1, location: 1 }, { unique: true });
locationStockSchema.index({ location: 1 });

const LocationStock = mongoose.model('LocationStock', locationStockSchema);

export default LocationStock;
