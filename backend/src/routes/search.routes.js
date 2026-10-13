import { Router } from 'express';
import { optionalProtect, requirePermission } from '../middleware/auth.js';
import {
  getSearchSuggestions,
  getTrendingSearches,
  trackSearch,
  trackSearchConversion,
  getSearchAnalytics,
} from '../controllers/search.controller.js';

const router = Router();

router.get('/suggestions', getSearchSuggestions);
router.get('/trending', getTrendingSearches);
router.post('/track', optionalProtect, trackSearch);
router.post('/convert', optionalProtect, trackSearchConversion);
router.get('/admin/analytics', ...requirePermission('reports:read'), getSearchAnalytics);

export default router;
