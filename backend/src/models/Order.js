import mongoose from 'mongoose';
import { ORDER_STATUS_VALUES } from '../constants/orderStatuses.js';
import geoFields from '../schemas/geoFields.js';

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    sku: { type: String, trim: true },
    variantLabelAr: { type: String, trim: true },
    variantLabelEn: { type: String, trim: true },
    nameAr: { type: String, required: true },
    nameEn: { type: String },
    price: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String },
    image: { type: String },
    substituted: { type: Boolean, default: false },
    substitutionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

const orderReturnSchema = new mongoose.Schema(
  {
    itemIndex: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sku: { type: String, trim: true },
    nameAr: { type: String, trim: true },
    nameEn: { type: String, trim: true },
    price: { type: Number, min: 0 },
    image: { type: String },
    lineTotal: { type: Number, min: 0, default: 0 },
    reasonKey: { type: String, trim: true, default: '' },
    reasonAr: { type: String, trim: true, default: '' },
    reasonEn: { type: String, trim: true, default: '' },
    customerNote: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    fulfillmentStatus: { type: String, trim: true, default: '' },
    fulfillmentHistory: {
      type: [
        {
          status: { type: String, required: true },
          changedAt: { type: Date, default: Date.now },
          changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          note: { type: String, trim: true, default: '' },
        },
      ],
      default: [],
    },
    refundAmount: { type: Number, min: 0, default: 0 },
    stripeRefundId: { type: String, default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedByRole: { type: String, enum: ['customer', 'staff'], default: 'customer' },
    requestedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    adminNote: { type: String, trim: true, default: '' },
    returnMethod: {
      type: String,
      enum: ['store_dropoff', 'home_pickup'],
      default: 'store_dropoff',
    },
    pickupDate: { type: Date, default: null },
    pickupSlotId: { type: String, trim: true, default: '' },
    pickupSlotFrom: { type: String, trim: true, default: '' },
    pickupSlotTo: { type: String, trim: true, default: '' },
    pickupSlotLabelAr: { type: String, trim: true, default: '' },
    pickupSlotLabelEn: { type: String, trim: true, default: '' },
    itemCondition: {
      type: String,
      enum: ['unopened', 'opened', 'damaged'],
      default: 'unopened',
    },
    itemConditionLabelAr: { type: String, trim: true, default: '' },
    itemConditionLabelEn: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
  },
  { _id: true, timestamps: true },
);

const substitutionSchema = new mongoose.Schema(
  {
    itemIndex: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, default: '' },
    original: {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      nameAr: String,
      nameEn: String,
      price: Number,
      quantity: Number,
    },
    replacement: {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
      nameAr: String,
      nameEn: String,
      price: Number,
      quantity: Number,
      image: String,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    priceDifference: { type: Number, default: 0 },
    suggestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    suggestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: false },
);

const orderMessageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, trim: true },
    authorRole: { type: String, enum: ['customer', 'staff'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    label: String,
    street: { type: String, required: true },
    building: String,
    floor: String,
    city: String,
    governorate: String,
    area: String,
    postalCode: String,
    ...geoFields,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(v) => v.length > 0, 'Order must have at least one item'],
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      trim: true,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'cod', 'instapay', 'vodafone_cash'],
      default: 'cod',
    },
    manualPaymentAccount: {
      type: String,
      trim: true,
      default: '',
    },
    paymentProofUrl: {
      type: String,
      trim: true,
      default: '',
    },
    paymentProofPublicId: {
      type: String,
      trim: true,
      default: '',
    },
    paymentProofUploadedAt: {
      type: Date,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      default: 'pending',
      trim: true,
    },
    stripeSessionId: {
      type: String,
      default: null,
    },
    deliveryMethod: {
      type: String,
      enum: ['scheduled', 'express', 'recurring'],
      default: 'scheduled',
    },
    deliveryZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryZone',
      default: null,
    },
    deliveryZoneNameAr: {
      type: String,
      trim: true,
    },
    deliveryZoneNameEn: {
      type: String,
      trim: true,
    },
    deliveryTimeSlot: {
      labelAr: String,
      labelEn: String,
      from: String,
      to: String,
    },
    scheduledDate: {
      type: Date,
    },
    recurringDelivery: {
      frequency: {
        type: String,
        enum: ['weekly', 'biweekly', 'monthly'],
        default: null,
      },
      preferredWeekday: { type: Number, min: 0, max: 6, default: null },
      preferredDayOfMonth: { type: Number, min: 1, max: 31, default: null },
      scheduleSummaryAr: { type: String, trim: true, default: '' },
      scheduleSummaryEn: { type: String, trim: true, default: '' },
      subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RecurringDeliverySubscription',
        default: null,
      },
      isFirstDelivery: { type: Boolean, default: false },
    },
    notes: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedDriverAt: { type: Date, default: null },
    fulfillmentLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FulfillmentLocation',
      default: null,
    },
    trackingEnabled: { type: Boolean, default: false },
    estimatedDeliveryAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastEditedAt: { type: Date, default: null },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    refundAmount: { type: Number, min: 0, default: 0 },
    refundReason: { type: String, trim: true, default: '' },
    refundedAt: { type: Date, default: null },
    stripeRefundId: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
    reviewRequestSentAt: { type: Date, default: null },
    substitutions: { type: [substitutionSchema], default: [] },
    returns: { type: [orderReturnSchema], default: [] },
    messages: { type: [orderMessageSchema], default: [] },
    adminMessagesReadAt: { type: Date, default: null },
    deliveryFailureReasonKey: { type: String, trim: true, default: '' },
    deliveryFailureReasonAr: { type: String, trim: true, default: '' },
    deliveryFailureReasonEn: { type: String, trim: true, default: '' },
    statusHistory: {
      type: [
        {
          status: { type: String, required: true },
          changedAt: { type: Date, default: Date.now },
          note: { type: String, trim: true, default: '' },
          changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

orderSchema.index({ assignedDriver: 1, orderStatus: 1 });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'returns.status': 1 });

orderSchema.pre('validate', function validateOrderStatus(next) {
  if (this.orderStatus && !ORDER_STATUS_VALUES.includes(this.orderStatus)) {
    this.invalidate('orderStatus', `\`${this.orderStatus}\` is not a valid order status`);
  }
  next();
});

if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

const Order = mongoose.model('Order', orderSchema);

export default Order;
