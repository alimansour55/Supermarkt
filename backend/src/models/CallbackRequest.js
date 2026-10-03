import mongoose from 'mongoose';

export const CALLBACK_REQUEST_STATUSES = ['pending', 'contacted', 'closed'];
export const CALLBACK_REQUEST_SOURCES = ['contact_page', 'assistant'];

/**
 * A customer's request to be called back by the support team — the "phone call
 * from the app" channel. The customer leaves a name/phone/note; an agent calls
 * them back manually and marks the request contacted/closed here.
 */
const callbackRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    name: { type: String, trim: true, required: true },
    phone: { type: String, trim: true, required: true },
    note: { type: String, trim: true, default: '' },
    source: { type: String, enum: CALLBACK_REQUEST_SOURCES, default: 'contact_page' },
    status: { type: String, enum: CALLBACK_REQUEST_STATUSES, default: 'pending', index: true },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
    adminNote: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

callbackRequestSchema.index({ status: 1, createdAt: -1 });

const CallbackRequest = mongoose.model('CallbackRequest', callbackRequestSchema);

export default CallbackRequest;
