import mongoose from 'mongoose';

const DELIVERY_TRACKING_STATUS_VALUES = ['idle', 'en_route', 'arrived', 'completed'];

const deliveryTrackingSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    heading: { type: Number, min: 0, max: 360, default: null },
    speed: { type: Number, min: 0, default: null },
    status: {
      type: String,
      enum: DELIVERY_TRACKING_STATUS_VALUES,
      default: 'idle',
    },
    // Cached driving route (driver → destination) so the customer poll does not
    // hit Google Directions on every request. Refreshed when the driver drifts
    // far from `routeComputedFrom` or the cache goes stale (see the service).
    routePolyline: { type: String, default: '' },
    routePath: {
      type: [{ lat: Number, lng: Number, _id: false }],
      default: undefined,
    },
    routeEtaSeconds: { type: Number, default: null },
    routeDistanceText: { type: String, default: '' },
    routeDistanceMeters: { type: Number, default: null },
    routeComputedAt: { type: Date, default: null },
    routeComputedFrom: {
      type: { lat: Number, lng: Number, _id: false },
      default: null,
    },
    updatedAt: { type: Date, default: Date.now },
    trackingLinkSmsSent: { type: Boolean, default: false },
    firstLocationSmsSent: { type: Boolean, default: false },
    etaAlertSmsSent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

deliveryTrackingSchema.pre('save', function touchUpdatedAt(next) {
  if (this.isModified('lat') || this.isModified('lng') || this.isModified('status')) {
    this.updatedAt = new Date();
  }
  next();
});

const DeliveryTracking = mongoose.model('DeliveryTracking', deliveryTrackingSchema);

export { DELIVERY_TRACKING_STATUS_VALUES };
export default DeliveryTracking;
