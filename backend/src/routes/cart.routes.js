import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  syncCart,
  mergeCart,
  applyDiscount,
  removeDiscount,
} from '../controllers/cart.controller.js';

const router = Router();

router.use(protect);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCartItem);
router.delete('/remove/:productId', removeFromCart);
router.delete('/clear', clearCart);

router.put('/sync', syncCart);
router.post('/merge', mergeCart);
router.post('/discount', applyDiscount);
router.delete('/discount', removeDiscount);

export default router;
