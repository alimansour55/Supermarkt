import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditLog.service.js';
import { getOrderResetStatus as getOrderResetStatusService, resetAllOrders as resetAllOrdersService } from '../services/orderReset.service.js';

export const getResetStatus = asyncHandler(async (req, res) => {
  const status = await getOrderResetStatusService();
  res.json({ success: true, ...status });
});

export const resetAllOrders = asyncHandler(async (req, res) => {
  const { deletedCount } = await resetAllOrdersService(req.body.confirmPhrase);

  await logAudit({
    req,
    action: 'reset',
    entityType: 'order',
    entityLabel: `All orders (${deletedCount} deleted)`,
    changes: { deletedCount },
  });

  res.json({ success: true, deletedCount });
});
