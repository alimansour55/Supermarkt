import mongoose from 'mongoose';

/**
 * Staff phone follow-up on a customer's idle cart: who called and when. One doc per customer,
 * overwritten on each call. Kept off Cart so marking a call never bumps the cart's updatedAt
 * (the "last activity" signal the reminder job counts from).
 */
const cartFollowUpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    contactedAt: { type: Date, required: true },
    contactedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    contactedByName: { type: String, default: '' },
    note: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);

const CartFollowUp = mongoose.model('CartFollowUp', cartFollowUpSchema);

export default CartFollowUp;
