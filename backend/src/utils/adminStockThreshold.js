import StoreSettings from '../models/StoreSettings.js';
import { LOW_STOCK_THRESHOLD } from '../services/inventoryAlert.service.js';

const SETTINGS_KEY = 'main';

export function normalizeAdminStockAlertThreshold(value, fallback = LOW_STOCK_THRESHOLD) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return Math.floor(fallback);
  return Math.min(9999, Math.floor(n));
}

export async function getAdminStockAlertThreshold() {
  try {
    const settings = await StoreSettings.findOne({ key: SETTINGS_KEY })
      .select('adminStockAlertThreshold')
      .lean();
    if (settings?.adminStockAlertThreshold != null) {
      return normalizeAdminStockAlertThreshold(settings.adminStockAlertThreshold);
    }
  } catch {
    /* ignore */
  }
  return LOW_STOCK_THRESHOLD;
}
