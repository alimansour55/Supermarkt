import { Router } from 'express';
import { getSitemapCategories, getSitemapProducts, getSitemapSellers } from '../controllers/sitemap.controller.js';

const router = Router();

router.get('/products', getSitemapProducts);
router.get('/categories', getSitemapCategories);
router.get('/sellers', getSitemapSellers);

export default router;
