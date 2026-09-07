import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { assistantChatLimiter } from '../middleware/rateLimiter.js';
import { getAssistantStatus, postAssistantChat } from '../controllers/assistant.controller.js';

const router = Router();

/** Attach user when token present; never block public assistant chat */
async function optionalUser(req, _res, next) {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
  } catch {
    // ignore invalid tokens
  }
  next();
}

router.get('/status', getAssistantStatus);
router.post('/chat', assistantChatLimiter, optionalUser, postAssistantChat);

export default router;
