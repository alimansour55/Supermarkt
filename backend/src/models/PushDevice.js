import mongoose from 'mongoose';

/** One app install that can receive push notifications (Firebase Cloud Messaging token). */
const pushDeviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    /** App language — pushes are sent in this language. */
    lang: { type: String, enum: ['ar', 'en'], default: 'ar' },
    appVersion: { type: String, trim: true, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const PushDevice = mongoose.model('PushDevice', pushDeviceSchema);

export default PushDevice;
