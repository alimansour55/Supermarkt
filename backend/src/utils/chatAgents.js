import ChatAgentProfile from '../models/ChatAgentProfile.js';
import SupportConversation from '../models/SupportConversation.js';
import { isLiveChatAvailableNow } from './liveChatAvailability.js';

export function isAgentAvailableNow(profile, now = new Date()) {
  if (!profile?.enabled) return false;
  return isLiveChatAvailableNow({
    enabled: true,
    scheduleEnabled: profile.scheduleEnabled === true,
    schedule: profile.schedule || [],
  }, now);
}

export function agentPublicName(profile, user) {
  return (profile?.displayName || user?.name || '').trim() || 'Support';
}

/** Designated agents and which of them are within their own hours right now. */
export async function getAgentAvailability() {
  const profiles = await ChatAgentProfile.find({ enabled: true }).populate('user', 'name isActive');
  const live = profiles.filter((p) => p.user && p.user.isActive !== false);
  const available = live.filter((p) => isAgentAvailableNow(p));
  return { designated: live.length, available };
}

/** Least-busy available agent, or null. */
export async function pickAvailableAgent() {
  const { available } = await getAgentAvailability();
  if (!available.length) return null;
  const counts = await SupportConversation.aggregate([
    { $match: { status: { $in: ['active', 'open', 'pending'] }, assignedTo: { $in: available.map((p) => p.user._id) } } },
    { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
  ]);
  const byUser = new Map(counts.map((c) => [String(c._id), c.n]));
  return [...available].sort((a, b) => (byUser.get(String(a.user._id)) || 0) - (byUser.get(String(b.user._id)) || 0))[0];
}
