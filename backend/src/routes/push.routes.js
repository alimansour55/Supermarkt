import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { getPushConfig, removeSubscription, saveSubscription } from '../services/push.service.js';

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ success: true, data: getPushConfig() });
});

router.post('/subscribe', protect, asyncHandler(async (req, res) => {
  if (!getPushConfig().enabled) throw new AppError('Push notifications are not configured', 503);
  const saved = await saveSubscription(req.user._id, req.body?.subscription, req.get('user-agent'));
  if (!saved) throw new AppError('Invalid push subscription', 400);
  res.json({ success: true });
}));

router.delete('/subscribe', protect, asyncHandler(async (req, res) => {
  await removeSubscription(req.user._id, req.body?.endpoint);
  res.json({ success: true });
}));

export default router;
