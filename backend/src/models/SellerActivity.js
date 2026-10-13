import mongoose from 'mongoose';

/**
 * Seller Center activity log — who in the seller's team did what ("Mai changed the price of
 * Honey 200 → 180"). Separate from the staff AuditLog: sellers only ever read their own rows.
 */
const sellerActivitySchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, trim: true, default: '' },
    /** e.g. product.update, product.price, inventory.bulk, order.status, team.add, security.password */
    action: { type: String, trim: true, required: true },
    entityType: { type: String, trim: true, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    label: { type: String, trim: true, default: '' },
    /** Small, display-ready details: { field: [from, to] } or free text. */
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sellerActivitySchema.index({ seller: 1, createdAt: -1 });
sellerActivitySchema.index({ seller: 1, action: 1, createdAt: -1 });
// Keep a year of history.
sellerActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 366 * 86400 });

const SellerActivity = mongoose.model('SellerActivity', sellerActivitySchema);

export default SellerActivity;
