import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import cartRoutes from './cart.routes.js';
import couponRoutes from './coupon.routes.js';
import orderRoutes from './order.routes.js';
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';
import bannerRoutes from './banner.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/cart', cartRoutes);
router.use('/coupons', couponRoutes);
router.use('/orders', orderRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/payment', paymentRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/banners', bannerRoutes);

export default router;
