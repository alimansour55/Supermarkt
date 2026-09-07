import mongoose from 'mongoose';

const readEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['new_order', 'low_stock', 'order_customer_message'],
      index: true,
    },
    titleAr: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    messageAr: { type: String, required: true, trim: true },
    messageEn: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    data: { type: mongoose.Schema.Types.Mixed },
    readBy: { type: [readEntrySchema], default: [] },
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
