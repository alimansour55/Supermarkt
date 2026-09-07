import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requirePermission } from '../middleware/auth.js';
import {
  getSearchSuggestions,
  getTrendingSearches,
  trackSearch,
  trackSearchConversion,
  getSearchAnalytics,
} from '../controllers/search.controller.js';

const router = Router();

/** Attach user when token present; never block public search endpoints */
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
    // ignore invalid tokens for analytics
  }
  next();
}

router.get('/suggestions', getSearchSuggestions);
router.get('/trending', getTrendingSearches);
router.post('/track', optionalUser, trackSearch);
router.post('/convert', optionalUser, trackSearchConversion);
router.get('/admin/analytics', ...requirePermission('reports:read'), getSearchAnalytics);

export default router;
