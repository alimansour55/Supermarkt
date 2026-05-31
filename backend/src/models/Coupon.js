import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percent', 'fixed', 'free_delivery'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minSubtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    labelAr: { type: String, trim: true },
    labelEn: { type: String, trim: true },
  },
  { timestamps: true },
);

couponSchema.methods.isValid = function isValid(subtotal = 0) {
  if (!this.isActive) return { valid: false, message: 'Coupon is inactive' };
  if (this.expiryDate && this.expiryDate < new Date()) {
    return { valid: false, message: 'Coupon has expired' };
  }
  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }
  if (subtotal < this.minSubtotal) {
    return { valid: false, message: `Minimum order ${this.minSubtotal} EGP required` };
  }
  return { valid: true, coupon: this };
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
