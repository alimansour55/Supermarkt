import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    nameAr: { type: String, trim: true, default: '' },
    nameEn: { type: String, trim: true, default: '' },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      default: 'email',
    },
    subjectAr: { type: String, trim: true, default: '' },
    subjectEn: { type: String, trim: true, default: '' },
    bodyHtmlAr: { type: String, default: '' },
    bodyHtmlEn: { type: String, default: '' },
    bodyTextAr: { type: String, default: '' },
    bodyTextEn: { type: String, default: '' },
    smsBodyAr: { type: String, default: '' },
    smsBodyEn: { type: String, default: '' },
    placeholders: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);

export default NotificationTemplate;
