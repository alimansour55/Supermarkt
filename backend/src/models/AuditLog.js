import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorName: { type: String, trim: true },
    actorRole: { type: String, trim: true },
    action: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete', 'status_change', 'bulk', 'refund', 'adjust', 'approve', 'reject', 'assign_driver', 'auto_assign_driver', 'driver_complete_delivery', 'driver_fail_delivery', 'update_tracking', 'driver_accept_delivery', 'driver_reject_delivery', 'driver_assignment_expired', 'driver_pickup', 'driver_arrive', 'cash_handover', 'cash_adjust', 'cancel', 'return_request', 'return_fulfillment', 'return_pickup_assign', 'return_pickup', 'trash', 'restore', 'reset'],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['product', 'order', 'user', 'category', 'coupon', 'banner', 'wallet', 'wallet_topup', 'store_settings'],
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
    entityLabel: { type: String, trim: true },
    changes: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
