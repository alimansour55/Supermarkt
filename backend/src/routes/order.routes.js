import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  calculateTotals,
  getAdminOrders,
  exportAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import { createOrderValidation, validate } from '../middleware/validate.js';

const router = Router();

router.post('/calculate', calculateTotals);

router.use(protect);

router.post('/', validate(createOrderValidation), createOrder);
router.get('/my-orders', getMyOrders);
router.get('/my', getMyOrders);
router.get('/admin/export', ...adminOnly, exportAdminOrders);
router.get('/admin', ...adminOnly, getAdminOrders);
router.get('/admin/:id', ...adminOnly, getAdminOrderById);
router.put('/admin/:id/status', ...adminOnly, updateOrderStatus);
router.get('/:id', getOrderById);

export default router;
