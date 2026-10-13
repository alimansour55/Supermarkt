import { Router } from 'express';
import { optionalProtect } from '../middleware/auth.js';
import { assistantChatLimiter } from '../middleware/rateLimiter.js';
import { getAssistantStatus, postAssistantChat } from '../controllers/assistant.controller.js';

const router = Router();

router.get('/status', getAssistantStatus);
router.post('/chat', assistantChatLimiter, optionalProtect, postAssistantChat);

export default router;
