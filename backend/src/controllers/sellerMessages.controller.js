/**
 * Seller Center → Messages: the store team's messages, warnings and health notices, and the
 * seller's replies (/api/seller/messages). Any login of the store can read and reply.
 */
import SellerMessage from '../models/SellerMessage.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getMarketplaceSettingsDoc } from '../services/marketplace.service.js';
import { listMessages, activeStrikes, enforcementConfig } from '../services/sellerMessage.service.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';

async function payload(sellerId) {
  const cfg = enforcementConfig(await getMarketplaceSettingsDoc());
  const [messages, strikes] = await Promise.all([
    listMessages(sellerId),
    activeStrikes(sellerId, { windowDays: cfg.strikeWindowDays }),
  ]);
  return {
    messages: messages.map(({ staffReadAt, ...m }) => ({ ...m, readByStore: Boolean(staffReadAt) })),
    strikes,
    maxStrikes: cfg.maxStrikes,
    strikeWindowDays: cfg.strikeWindowDays,
    autoSuspend: cfg.autoSuspend,
  };
}

export const listMyMessages = asyncHandler(async (req, res) => {
  await SellerMessage.updateMany(
    { seller: req.seller._id, from: { $ne: 'seller' }, sellerReadAt: null },
    { $set: { sellerReadAt: new Date() } },
  );
  res.json({ success: true, data: await payload(req.seller._id) });
});

export const replyMyMessage = asyncHandler(async (req, res) => {
  const body = String(req.body?.body || '').trim().slice(0, 4000);
  if (!body) throw new AppError('Write a message', 400);
  const recent = await SellerMessage.countDocuments({ seller: req.seller._id, from: 'seller', createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });
  if (recent >= 20) throw new AppError('Too many messages in an hour — please wait a little', 429);
  await SellerMessage.create({
    seller: req.seller._id,
    from: 'seller',
    kind: 'message',
    author: req.user._id,
    authorName: req.user.name,
    body,
    sellerReadAt: new Date(),
  });
  await logSellerActivity(req, { action: 'store.message', entityType: 'seller', entityId: req.seller._id, label: body.slice(0, 60) });
  res.status(201).json({ success: true, data: await payload(req.seller._id) });
});

/** Badge count for the Seller Center menu. */
export function unreadStoreMessages(sellerId) {
  return SellerMessage.countDocuments({ seller: sellerId, from: { $ne: 'seller' }, sellerReadAt: null });
}
