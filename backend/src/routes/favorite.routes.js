import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  addFavorite,
  getFavorites,
  mergeFavorites,
  removeFavorite,
} from '../controllers/favorite.controller.js';

const router = Router();

router.use(protect);
router.get('/', getFavorites);
router.post('/merge', mergeFavorites);
router.post('/:productId', addFavorite);
router.delete('/:productId', removeFavorite);

export default router;
