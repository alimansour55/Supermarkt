import mongoose from 'mongoose';

const FREE_DELIVERY_METHOD_VALUES = ['scheduled', 'express', 'recurring'];

const timeSlotSchema = new mongoose.Schema(
  {
    labelAr: { type: String, trim: true, required: true },
    labelEn: { type: String, trim: true, required: true },
    from: { type: String, trim: true, required: true },
    to: { type: String, trim: true, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const deliveryZoneSchema = new mongoose.Schema(
  {
    cityAr: { type: String, trim: true, required: true },
    cityEn: { type: String, trim: true, required: true },
    areaAr: { type: String, trim: true, required: true },
    areaEn: { type: String, trim: true, required: true },
    slug: { type: String, trim: true, lowercase: true, unique: true, index: true },
    scheduledFee: { type: Number, min: 0, default: 29.99 },
    expressFee: { type: Number, min: 0, default: 49.99 },
    minimumOrder: { type: Number, min: 0, default: 0 },
    freeDeliveryThreshold: { type: Number, min: 0, default: 500 },
    freeDeliveryOverride: { type: Boolean, default: false },
    freeDeliveryMethods: {
      type: [{ type: String, enum: FREE_DELIVERY_METHOD_VALUES }],
      default: ['scheduled', 'recurring'],
    },
    scheduledAvailable: { type: Boolean, default: true },
    expressAvailable: { type: Boolean, default: true },
    estimatedScheduled: { type: String, trim: true, default: '4-6 hours' },
    estimatedExpress: { type: String, trim: true, default: 'within 2 hours' },
    timeSlots: { type: [timeSlotSchema], default: [] },
    /** When true, scheduledMinLeadMinutes / expressMinLeadMinutes override global store settings. */
    leadTimeOverride: { type: Boolean, default: false },
    scheduledMinLeadMinutes: { type: Number, min: 0, max: 1440, default: 120 },
    expressMinLeadMinutes: { type: Number, min: 0, max: 1440, default: 120 },
    priority: { type: Number, default: 0 },
    /** Geo anchor — lets the startup location popup map a dropped pin to this zone. */
    centerLat: { type: Number, default: null },
    centerLng: { type: Number, default: null },
    radiusKm: { type: Number, min: 0, default: 8 },
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

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

deliveryZoneSchema.pre('validate', function setSlug(next) {
  if (this.areaEn) {
    this.slug = slugify(this.areaEn);
  }
  next();
});

const DeliveryZone = mongoose.model('DeliveryZone', deliveryZoneSchema);

export default DeliveryZone;
