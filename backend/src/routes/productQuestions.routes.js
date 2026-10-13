import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { listProductQuestions, askProductQuestion } from '../controllers/sellerCatalog.controller.js';

/** Public product Q&A — reading is open, asking needs a signed-in customer. */
const router = Router();

router.get('/', listProductQuestions);
router.post('/', protect, askProductQuestion);

export default router;
