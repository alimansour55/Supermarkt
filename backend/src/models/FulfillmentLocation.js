import mongoose from 'mongoose';
import geoFields from '../schemas/geoFields.js';

const fulfillmentLocationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    address: { type: String, trim: true, required: true },
    ...geoFields,
    isDefault: { type: Boolean, default: false },
    deliveryZones: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryZone',
    }],
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

fulfillmentLocationSchema.index({ isDefault: 1, isActive: 1 });
fulfillmentLocationSchema.index({ deliveryZones: 1, isActive: 1 });

const FulfillmentLocation = mongoose.model('FulfillmentLocation', fulfillmentLocationSchema);

export default FulfillmentLocation;
