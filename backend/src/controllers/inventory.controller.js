import { asyncHandler } from '../middleware/errorHandler.js';
import { syncInventoryReservations } from '../services/inventoryReservation.service.js';
import { resolveRequestLang } from '../utils/stockMessages.js';

/** Hold stock during checkout (15 min TTL). */
export const reserveCheckoutInventory = asyncHandler(async (req, res) => {
  const { items = [], lang: rawLang } = req.body;
  const lang = resolveRequestLang({ lang: rawLang });
  const result = await syncInventoryReservations(req.user._id, items, lang);
  res.json({ success: true, ...result });
});
