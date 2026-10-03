import mongoose from 'mongoose';
import { PAYMENT_METHOD_IDS } from '../constants/paymentMethods.js';

const subscriptionItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    quantity: { type: Number, min: 1, required: true },
    nameAr: { type: String, trim: true, default: '' },
    nameEn: { type: String, trim: true, default: '' },
    price: { type: Number, min: 0, required: true },
    unit: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const recurringDeliverySubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    items: {
      type: [subscriptionItemSchema],
      default: [],
    },
    shippingAddress: {
      label: String,
      street: String,
      building: String,
      floor: String,
      city: String,
      governorate: String,
      area: String,
      postalCode: String,
    },
    phone: { type: String, trim: true, required: true },
    deliveryZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryZone',
      default: null,
    },
    deliveryZoneNameAr: { type: String, trim: true, default: '' },
    deliveryZoneNameEn: { type: String, trim: true, default: '' },
    deliveryTimeSlot: {
      labelAr: String,
      labelEn: String,
      from: String,
      to: String,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
      required: true,
    },
    preferredWeekday: {
      type: Number,
      min: 0,
      max: 6,
      default: null,
    },
    preferredDayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
      default: null,
    },
    scheduleSummaryAr: { type: String, trim: true, default: '' },
    scheduleSummaryEn: { type: String, trim: true, default: '' },
    startDate: { type: Date, required: true },
    nextDeliveryDate: { type: Date, required: true, index: true },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_IDS,
      default: 'cod',
    },
    isActive: { type: Boolean, default: true, index: true },
    pausedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    lastFulfilledAt: { type: Date, default: null },
    deliveriesCount: { type: Number, min: 0, default: 0 },
    adminNotes: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

recurringDeliverySubscriptionSchema.index({ user: 1, isActive: 1 });

const RecurringDeliverySubscription = mongoose.model(
  'RecurringDeliverySubscription',
  recurringDeliverySubscriptionSchema,
);

export default RecurringDeliverySubscription;
