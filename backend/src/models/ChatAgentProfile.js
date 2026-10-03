import mongoose from 'mongoose';

const agentScheduleEntrySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    enabled: { type: Boolean, default: true },
    from: { type: String, trim: true, default: '09:00' },
    to: { type: String, trim: true, default: '17:00' },
  },
  { _id: false },
);

export const defaultAgentSchedule = () => [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day, enabled: day !== 5, from: '09:00', to: '17:00',
}));

/**
 * Live-chat settings of a staff member. Kept apart from User so the private
 * WhatsApp number can never leak through any user payload.
 */
const chatAgentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    /** Set by a super admin: this staff member is a designated live-chat agent. */
    enabled: { type: Boolean, default: false },
    /** Name shown to customers: "You are chatting with …". */
    displayName: { type: String, trim: true, maxlength: 60, default: '' },
    /** Private — used to notify the agent / for WhatsApp routing. Never sent to customers. */
    whatsappNumber: { type: String, trim: true, default: '' },
    scheduleEnabled: { type: Boolean, default: false },
    schedule: { type: [agentScheduleEntrySchema], default: defaultAgentSchedule },
  },
  { timestamps: true },
);

export default mongoose.model('ChatAgentProfile', chatAgentProfileSchema);
