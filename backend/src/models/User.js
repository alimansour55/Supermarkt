import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
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
      enum: ['user', 'manager', 'admin', 'super_admin'],
      default: 'user',
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

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

const User = mongoose.model('User', userSchema);

export default User;
