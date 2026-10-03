import mongoose from 'mongoose';

/** Staff/system-visible lifecycle. 'draft' (no capacity/queue decision yet) and legacy 'open' (alias of 'active') are valid schema values but never chosen by staff directly. */
export const SUPPORT_CONVERSATION_STATUSES = ['queued', 'active', 'pending', 'closed'];

/**
 * A general (not order-bound) live-chat thread between a signed-in customer
 * and a staff member — the "talk to a real person" escalation from the
 * storefront assistant widget. One non-closed conversation per customer.
 */
const supportMessageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: function requiredAuthor() { return this.authorRole !== 'system'; } },
    authorName: { type: String, trim: true, default: '' },
    authorRole: { type: String, enum: ['customer', 'staff', 'system'], required: true },
    /** Localised client-side for system lines: 'ack' | 'joined'. */
    systemKey: { type: String, trim: true, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const supportConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [...SUPPORT_CONVERSATION_STATUSES, 'draft', 'open'],
      default: 'draft',
      index: true,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    /** Bumped only by customer messages — compared against staffReadAt for the unread badge. */
    lastCustomerMessageAt: { type: Date, default: Date.now },
    staffReadAt: { type: Date, default: null },
    /** Set when status becomes 'queued' — orders the queue and drives position/promotion. */
    queuedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    /** Customer tapped continue on the idle prompt - restarts the idle clock. */
    keepAliveAt: { type: Date, default: null },
    closedBy: { type: String, enum: ['customer', 'staff', 'system', null], default: null },
    /** Public display name of the assigned agent (never the agent's private data). */
    assignedAgentName: { type: String, trim: true, default: '' },
    channel: { type: String, enum: ['web', 'whatsapp'], default: 'web' },
    /** Customer WhatsApp number (digits) when channel === 'whatsapp'. Staff-only. */
    waPhone: { type: String, trim: true, default: '' },
    rating: {
      score: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, trim: true, maxlength: 500, default: '' },
      ratedAt: { type: Date, default: null },
    },
    messages: { type: [supportMessageSchema], default: [] },
  },
  { timestamps: true },
);

supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ status: 1, queuedAt: 1 });
supportConversationSchema.index({ user: 1, status: 1, closedAt: -1 });

const SupportConversation = mongoose.model('SupportConversation', supportConversationSchema);

export default SupportConversation;
