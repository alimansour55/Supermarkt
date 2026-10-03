import { Router } from 'express';
import { getSitemapCategories, getSitemapProducts } from '../controllers/sitemap.controller.js';

const router = Router();

router.get('/products', getSitemapProducts);
router.get('/categories', getSitemapCategories);

export default router;
