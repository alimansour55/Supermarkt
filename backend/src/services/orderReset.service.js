import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';

/** Orders still in flight — reset refuses to run while any of these exist, so a
 * live customer order or an out-for-delivery driver run can never be wiped out. */
export const ACTIVE_ORDER_STATUSES = ['pending', 'preparing', 'confirmed', 'out_for_delivery'];

export const RESET_CONFIRM_PHRASE = 'RESET';

export async function getOrderResetStatus() {
  const [totalOrders, activeOrders] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ orderStatus: { $in: ACTIVE_ORDER_STATUSES } }),
  ]);
  return { totalOrders, activeOrders, canReset: activeOrders === 0 && totalOrders > 0 };
}

/**
 * Deletes every order document — active, completed, and trashed — so the store
 * looks exactly as if no one had ever ordered. Scoped to the Order collection
 * only: loyalty points, wallet balances, coupon usage counters, and stock levels
 * are left untouched.
 */
export async function resetAllOrders(confirmPhrase) {
  if (confirmPhrase !== RESET_CONFIRM_PHRASE) {
    throw new AppError(`Type "${RESET_CONFIRM_PHRASE}" to confirm`, 400);
  }

  const activeOrders = await Order.countDocuments({ orderStatus: { $in: ACTIVE_ORDER_STATUSES } });
  if (activeOrders > 0) {
    throw new AppError(
      `Cannot reset while ${activeOrders} order${activeOrders === 1 ? ' is' : 's are'} still active (pending, preparing, or out for delivery). Complete or cancel them first.`,
      409,
    );
  }

  const result = await Order.deleteMany({});
  return { deletedCount: result.deletedCount };
}
