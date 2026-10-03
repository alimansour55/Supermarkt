import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import { supportChatMessageLimiter } from '../middleware/rateLimiter.js';
import {
  getMyConversation,
  postMyMessage,
  closeMyConversation,
  getMyHistory,
  rateMyConversation,
  keepMyConversationAlive,
  listAdminConversations,
  getAdminConversationMessages,
  postAdminMessage,
  patchAdminConversation,
  getConversationHistoryForUser,
} from '../controllers/supportConversation.controller.js';
import {
  listAgents,
  setAgentEnabled,
  getMyAgentProfile,
  updateMyAgentProfile,
  getPerformance,
} from '../controllers/chatAgent.controller.js';

const router = Router();

// Customer — signed-in only
router.get('/me', protect, getMyConversation);
router.get('/me/history', protect, getMyHistory);
router.post('/me/messages', protect, supportChatMessageLimiter, postMyMessage);
router.post('/me/close', protect, supportChatMessageLimiter, closeMyConversation);
router.post('/me/keepalive', protect, supportChatMessageLimiter, keepMyConversationAlive);
router.post('/me/:id/rate', protect, supportChatMessageLimiter, rateMyConversation);

// Admin
const canChat = requirePermission('support:chat');
router.get('/admin/agents', ...canChat, listAgents);
router.get('/admin/agents/me', ...canChat, getMyAgentProfile);
router.patch('/admin/agents/me', ...canChat, updateMyAgentProfile);
router.patch('/admin/agents/:userId', ...canChat, setAgentEnabled);
router.get('/admin/performance', ...canChat, getPerformance);
router.get('/admin', ...canChat, listAdminConversations);
router.get('/admin/history/:userId', ...canChat, getConversationHistoryForUser);
router.get('/admin/:id/messages', ...canChat, getAdminConversationMessages);
router.post('/admin/:id/messages', ...canChat, postAdminMessage);
router.patch('/admin/:id', ...canChat, patchAdminConversation);

export default router;
