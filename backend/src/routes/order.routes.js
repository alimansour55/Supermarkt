import { Router } from 'express';
import { protect, optionalProtect, driverOnly, requirePermission } from '../middleware/auth.js';
import { driverLocationLimiter, adminTrackingUpdateLimiter } from '../middleware/rateLimiter.js';
import {
  createOrder,
  getMyOrders,
  getMyRecurringDeliveries,
  updateMyRecurringDelivery,
  pauseMyRecurringDelivery,
  resumeMyRecurringDelivery,
  cancelMyRecurringDelivery,
  getAdminRecurringDeliveries,
  getAdminRecurringStats,
  getAdminRecurringDeliveryById,
  updateAdminRecurringDelivery,
  pauseAdminRecurringDelivery,
  resumeAdminRecurringDelivery,
  cancelAdminRecurringDelivery,
  advanceAdminRecurringDelivery,
  getOrderById,
  calculateTotals,
  getAdminOrders,
  getAdminOrderChats,
  exportAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import {
  cancelMyOrder,
  cancelAdminOrder,
  refundAdminOrder,
  updateMyOrderItems,
  suggestSubstitution,
  respondToSubstitution,
  assignDriver,
  getDeliveryStaff,
  addCustomerMessage,
  addAdminMessage,
  getOrderMessages,
  downloadOrderInvoice,
  uploadOrderPaymentProof,
} from '../controllers/orderManagement.controller.js';
import {
  requestCustomerReturn,
  requestAdminReturn,
  patchAdminReturn,
  updateAdminReturnFulfillment,
  getAdminReturns,
} from '../controllers/orderReturn.controller.js';
import {
  getOrderTrash,
  trashOrder,
  trashOrderSecond,
  restoreOrder,
  deleteOrderForever,
  bulkTrashOrders,
  bulkTrashOrdersSecond,
  bulkRestoreOrders,
  bulkDeleteOrdersForever,
} from '../controllers/orderTrash.controller.js';
import { getResetStatus, resetAllOrders } from '../controllers/orderReset.controller.js';
import {
  getCustomerOrderTracking,
  updateAdminOrderTracking,
  getAdminLiveDeliveries,
  getAdminOrderTracking,
} from '../controllers/deliveryTracking.controller.js';
import {
  getDriverDeliveries,
  getDriverDeliveryById,
  getDriverHistory,
  getDriverConfig,
  updateDriverAvailability,
  updateDriverOrderLocation,
  completeDriverDelivery,
  failDriverDelivery,
} from '../controllers/driver.controller.js';
import {
  startDriverSimulation,
  stopDriverSimulation,
  getDriverSimulationStatus,
} from '../controllers/deliveryTrackingSim.controller.js';
import { optionalUploadSingle, parseOrderMultipartBody, uploadSingle } from '../middleware/upload.js';
import { createOrderValidation, updateOrderItemsValidation, updateRecurringDeliveryValidation, driverTrackingLocationValidation, driverFailDeliveryValidation, validate } from '../middleware/validate.js';

const router = Router();

router.post('/calculate', optionalProtect, calculateTotals);

router.use(protect);

router.post('/', optionalUploadSingle('paymentProof'), parseOrderMultipartBody, validate(createOrderValidation), createOrder);
router.get('/my-orders', getMyOrders);
router.get('/my', getMyOrders);
router.get('/recurring-deliveries', getMyRecurringDeliveries);
router.patch('/recurring-deliveries/:id', validate(updateRecurringDeliveryValidation), updateMyRecurringDelivery);
router.patch('/recurring-deliveries/:id/pause', pauseMyRecurringDelivery);
router.patch('/recurring-deliveries/:id/resume', resumeMyRecurringDelivery);
router.patch('/recurring-deliveries/:id/cancel', cancelMyRecurringDelivery);

router.get('/admin/delivery-staff', ...requirePermission('orders:read'), getDeliveryStaff);
router.get('/admin/live-deliveries', ...requirePermission('orders:read'), getAdminLiveDeliveries);
router.get('/admin/recurring-deliveries/stats', ...requirePermission('orders:read'), getAdminRecurringStats);
router.get('/admin/recurring-deliveries', ...requirePermission('orders:read'), getAdminRecurringDeliveries);
router.get('/admin/recurring-deliveries/:id', ...requirePermission('orders:read'), getAdminRecurringDeliveryById);
router.patch('/admin/recurring-deliveries/:id', ...requirePermission('orders:write'), validate(updateRecurringDeliveryValidation), updateAdminRecurringDelivery);
router.patch('/admin/recurring-deliveries/:id/pause', ...requirePermission('orders:write'), pauseAdminRecurringDelivery);
router.patch('/admin/recurring-deliveries/:id/resume', ...requirePermission('orders:write'), resumeAdminRecurringDelivery);
router.patch('/admin/recurring-deliveries/:id/cancel', ...requirePermission('orders:write'), cancelAdminRecurringDelivery);
router.post('/admin/recurring-deliveries/:id/advance', ...requirePermission('orders:write'), advanceAdminRecurringDelivery);
router.get('/admin/export', ...requirePermission('orders:read'), exportAdminOrders);
router.get('/admin/messages', ...requirePermission('orders:read'), getAdminOrderChats);
router.get('/admin/returns', ...requirePermission('orders:read'), getAdminReturns);
router.get('/admin', ...requirePermission('orders:read'), getAdminOrders);
router.get('/admin/trash', ...requirePermission('orders:delete'), getOrderTrash);
router.post('/admin/trash/bulk', ...requirePermission('orders:delete'), bulkTrashOrders);
router.post('/admin/trash/second/bulk', ...requirePermission('orders:delete'), bulkTrashOrdersSecond);
router.post('/admin/restore/bulk', ...requirePermission('orders:delete'), bulkRestoreOrders);
router.post('/admin/permanent/bulk', ...requirePermission('orders:delete'), bulkDeleteOrdersForever);
router.get('/admin/reset-all/status', ...requirePermission('orders:reset'), getResetStatus);
router.post('/admin/reset-all', ...requirePermission('orders:reset'), resetAllOrders);
router.get('/admin/:id/invoice', ...requirePermission('orders:read'), downloadOrderInvoice);
router.get('/admin/:id', ...requirePermission('orders:read'), getAdminOrderById);
router.put('/admin/:id/status', ...requirePermission('orders:write'), updateOrderStatus);
router.patch('/admin/:id/trash', ...requirePermission('orders:delete'), trashOrder);
router.patch('/admin/:id/trash/second', ...requirePermission('orders:delete'), trashOrderSecond);
router.patch('/admin/:id/restore', ...requirePermission('orders:delete'), restoreOrder);
router.delete('/admin/:id/permanent', ...requirePermission('orders:delete'), deleteOrderForever);
router.post('/admin/:id/cancel', ...requirePermission('orders:write'), cancelAdminOrder);
router.post('/admin/:id/refund', ...requirePermission('orders:write'), refundAdminOrder);
router.post('/admin/:id/substitutions', ...requirePermission('orders:write'), suggestSubstitution);
router.put('/admin/:id/assign-driver', ...requirePermission('orders:write'), assignDriver);
router.get('/admin/:id/tracking', ...requirePermission('orders:read'), getAdminOrderTracking);
router.put('/admin/:id/tracking', ...requirePermission('orders:write'), adminTrackingUpdateLimiter, updateAdminOrderTracking);
// Dev-only driver simulator (no-op in production — see the controller).
router.get('/admin/:id/tracking/simulate', ...requirePermission('orders:read'), getDriverSimulationStatus);
router.post('/admin/:id/tracking/simulate', ...requirePermission('orders:write'), startDriverSimulation);
router.delete('/admin/:id/tracking/simulate', ...requirePermission('orders:write'), stopDriverSimulation);
router.get('/admin/:id/messages', ...requirePermission('orders:read'), getOrderMessages);
router.post('/admin/:id/messages', ...requirePermission('orders:write'), addAdminMessage);
router.post('/admin/:id/returns', ...requirePermission('orders:write'), requestAdminReturn);
router.patch('/admin/:id/returns/:returnId/fulfillment', ...requirePermission('orders:write'), updateAdminReturnFulfillment);
router.patch('/admin/:id/returns/:returnId', ...requirePermission('orders:write'), patchAdminReturn);

router.post('/:id/payment-proof', uploadSingle('paymentProof'), uploadOrderPaymentProof);
router.get('/:id/invoice', downloadOrderInvoice);
router.patch('/:id/items', validate(updateOrderItemsValidation), updateMyOrderItems);
router.post('/:id/cancel', cancelMyOrder);
router.post('/:id/returns', requestCustomerReturn);
router.put('/:id/substitutions/:subId', respondToSubstitution);
router.get('/:id/messages', getOrderMessages);
router.post('/:id/messages', addCustomerMessage);

router.get('/driver/config', ...driverOnly, getDriverConfig);
router.put('/driver/availability', ...driverOnly, updateDriverAvailability);
router.get('/driver/deliveries', ...driverOnly, getDriverDeliveries);
router.get('/driver/deliveries/history', ...driverOnly, getDriverHistory);
router.get('/driver/deliveries/:id', ...driverOnly, getDriverDeliveryById);
router.post('/driver/deliveries/:id/complete', ...driverOnly, optionalUploadSingle('proofPhoto'), completeDriverDelivery);
router.post('/driver/deliveries/:id/fail', ...driverOnly, validate(driverFailDeliveryValidation), failDriverDelivery);
router.put('/:id/tracking/location', ...driverOnly, driverLocationLimiter, validate(driverTrackingLocationValidation), updateDriverOrderLocation);

router.get('/:id/tracking', getCustomerOrderTracking);
router.get('/:id', getOrderById);

export default router;
