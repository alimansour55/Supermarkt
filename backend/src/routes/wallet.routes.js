import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { getMyWallet, createTopUp, getTopUp } from '../controllers/wallet.controller.js';
import {
  getAdminWalletOverview,
  getAdminWalletSettings,
  updateAdminWalletSettings,
  listAdminTopUps,
  approveAdminTopUp,
  rejectAdminTopUp,
  searchAdminWalletUsers,
  getAdminUserWallet,
  adjustAdminUserWallet,
} from '../controllers/walletAdmin.controller.js';

const router = Router();

router.use(protect);

// Customer
router.get('/me', getMyWallet);
router.post('/topup', uploadSingle('proof'), createTopUp);
router.get('/topup/:id', getTopUp);

// Admin
const canManage = requirePermission('settings:write');
router.get('/admin/overview', ...canManage, getAdminWalletOverview);
router.get('/admin/settings', ...canManage, getAdminWalletSettings);
router.put('/admin/settings', ...canManage, updateAdminWalletSettings);
router.get('/admin/topups', ...canManage, listAdminTopUps);
router.post('/admin/topups/:id/approve', ...canManage, approveAdminTopUp);
router.post('/admin/topups/:id/reject', ...canManage, rejectAdminTopUp);
router.get('/admin/users', ...canManage, searchAdminWalletUsers);
router.get('/admin/users/:userId', ...canManage, getAdminUserWallet);
router.post('/admin/users/:userId/adjust', ...canManage, adjustAdminUserWallet);

export default router;
