import { notifyLowStock } from './notification.service.js';
import { sendLowStockEmail } from '../emails/index.js';

export const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 10;

export async function checkInventoryAlert(product, previousStock) {
  if (!product?.isActive) return;

  const stock = Number(product.stock);
  const prev = previousStock != null ? Number(previousStock) : null;

  const isLow = stock <= LOW_STOCK_THRESHOLD;
  const wasAbove = prev == null || prev > LOW_STOCK_THRESHOLD;

  if (!isLow || !wasAbove) return;

  try {
    const notification = await notifyLowStock(product, LOW_STOCK_THRESHOLD);
    await sendLowStockEmail(product, LOW_STOCK_THRESHOLD);
    return notification;
  } catch (err) {
    console.error('Inventory alert failed:', err.message);
  }
}
