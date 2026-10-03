import mongoose from 'mongoose';

const USER_NOTIFICATION_TYPES = [
  'order_status',
  'order_driver_assigned',
  'order_tracking_live',
  'order_driver_location',
  'order_eta_update',
  'wallet_topup_approved',
  'wallet_topup_rejected',
  'wallet_credit',
  'wallet_debit',
  'support_chat_reply',
];

const userNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: USER_NOTIFICATION_TYPES,
      index: true,
    },
    titleAr: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    messageAr: { type: String, required: true, trim: true },
    messageEn: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userNotificationSchema.index({ user: 1, createdAt: -1 });
userNotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

const UserNotification = mongoose.model('UserNotification', userNotificationSchema);

export { USER_NOTIFICATION_TYPES };
export default UserNotification;
