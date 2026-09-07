import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getMyNotifications,
  getMyUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} from '../controllers/userNotification.controller.js';

const router = Router();

router.use(protect);

router.get('/', getMyNotifications);
router.get('/unread-count', getMyUnreadNotificationCount);
router.patch('/read-all', markAllMyNotificationsRead);
router.patch('/:id/read', markMyNotificationRead);

export default router;
