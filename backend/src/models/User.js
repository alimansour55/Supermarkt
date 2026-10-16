import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { STAFF_ROLES } from '../constants/roles.js';
import { ALL_PERMISSIONS } from '../constants/permissions.js';
import { SELLER_PERMISSIONS, SELLER_ROLES } from '../constants/marketplace.js';
import geoFields from '../schemas/geoFields.js';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    street: { type: String, trim: true, required: true },
    building: { type: String, trim: true },
    floor: { type: String, trim: true },
    city: { type: String, trim: true, required: true },
    governorate: { type: String, trim: true },
    area: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    ...geoFields,
  },
  { _id: true },
);

const pointsHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['earn', 'redeem', 'adjust', 'expire', 'refund'],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: [/^[a-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, hyphens, and underscores'],
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'manager', 'admin', 'super_admin', 'driver', ...SELLER_ROLES],
      default: 'user',
    },
    permissions: {
      type: [{
        type: String,
        enum: ALL_PERMISSIONS,
      }],
      default: [],
    },
    /** Marketplace seller accounts only — the seller business this user belongs to. */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
      index: true,
    },
    /** Seller staff only — what this login may do (owners can do everything). */
    sellerPermissions: {
      type: [{ type: String, enum: SELLER_PERMISSIONS }],
      default: undefined,
    },
    /** Bumped to sign out every device (tokens carry it as `sv`). */
    sessionVersion: { type: Number, default: 0 },
    /** Seller logins: email a one-time code on every sign-in. */
    twoFactorEnabled: { type: Boolean, default: false },
    /** Seller logins: staff set a temporary password — the user must pick their own next. */
    mustChangePassword: { type: Boolean, default: false },
    /** Seller logins: wrong passwords in a row; too many locks sign-in for a while. */
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    loginCodeHash: { type: String, select: false },
    loginCodeExpires: { type: Date, select: false },
    loginCodeAttempts: { type: Number, default: 0, select: false },
    /** Last sign-ins (newest first, max 10) — shown on the seller Security page. */
    loginHistory: {
      type: [{
        _id: false,
        at: { type: Date, default: Date.now },
        ip: { type: String, trim: true, default: '' },
        userAgent: { type: String, trim: true, default: '' },
      }],
      default: [],
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    /** Delivery drivers only — whether the driver is on shift and can receive auto-assigned orders. */
    driverAvailable: {
      type: Boolean,
      default: true,
    },
    driverAvailableAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: true,
    },
    phoneOtpHash: {
      type: String,
      select: false,
    },
    phoneOtpExpires: {
      type: Date,
      select: false,
    },
    phoneOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lastOtpSentAt: {
      type: Date,
      select: false,
    },
    // Legacy email fields — kept for backward compatibility
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    favorites: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      }],
      default: [],
    },
    pointsBalance: {
      type: Number,
      min: 0,
      default: 0,
    },
    pointsHistory: {
      type: [pointsHistorySchema],
      default: [],
    },
    /** Store-wallet balance in EGP. Ledger lives in the WalletTransaction collection. */
    walletBalance: {
      type: Number,
      min: 0,
      default: 0,
    },
    reviewBlocked: {
      type: Boolean,
      default: false,
    },
    /** Private note staff keep about this customer — never shown to the customer. */
    adminNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    /** Set when an admin deletes a customer who has order/wallet history: the record is anonymized, not removed. */
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

userSchema.pre('validate', function requirePhoneForCustomers(next) {
  const isStaffWithUsername = STAFF_ROLES.includes(this.role) && this.username;
  // Seller accounts sign in with email + password; their phone lives on the Seller doc,
  // so a seller can also keep a separate customer account on the same phone number.
  const isSellerWithEmail = SELLER_ROLES.includes(this.role) && this.email;
  if (!isStaffWithUsername && !isSellerWithEmail && !this.deletedAt && !this.phone) {
    this.invalidate('phone', 'Phone number is required');
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.createPhoneOtp = function createPhoneOtp() {
  const code = String(crypto.randomInt(100000, 999999));
  this.phoneOtpHash = crypto.createHash('sha256').update(code).digest('hex');
  this.phoneOtpExpires = Date.now() + 10 * 60 * 1000;
  this.phoneOtpAttempts = 0;
  this.lastOtpSentAt = new Date();
  return code;
};

userSchema.methods.verifyPhoneOtp = function verifyPhoneOtp(code) {
  if (!this.phoneOtpHash || !this.phoneOtpExpires || Date.now() > this.phoneOtpExpires) {
    return { ok: false, reason: 'expired' };
  }

  if (this.phoneOtpAttempts >= 5) {
    return { ok: false, reason: 'locked' };
  }

  this.phoneOtpAttempts += 1;

  const hash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  if (hash !== this.phoneOtpHash) {
    return { ok: false, reason: 'invalid' };
  }

  this.phoneOtpHash = undefined;
  this.phoneOtpExpires = undefined;
  this.phoneOtpAttempts = 0;
  this.isPhoneVerified = true;
  this.mfaEnabled = true;
  return { ok: true };
};

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } },
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string', $gt: '' } } },
);
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string', $gt: '' } } },
);

const User = mongoose.model('User', userSchema);

export default User;
