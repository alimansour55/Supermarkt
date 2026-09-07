/** Return pickup / drop-off options — keep in sync with frontend returnPickup.js */

export const RETURN_METHODS = [
  {
    id: 'store_dropoff',
    labelAr: 'تسليم في فرع المتجر',
    labelEn: 'Drop off at store branch',
    descriptionAr: 'أحضر المنتج إلى أقرب فرع في الموعد المحدد',
    descriptionEn: 'Bring the product to the nearest branch at your scheduled time',
  },
  {
    id: 'home_pickup',
    labelAr: 'استلام من المنزل',
    labelEn: 'Home pickup',
    descriptionAr: 'يرسل المندوب لاستلام المنتج من عنوان الطلب',
    descriptionEn: 'A driver will collect the product from your order address',
  },
];

export const RETURN_PICKUP_SLOTS = [
  { id: 'morning', from: '09:00', to: '12:00', labelAr: 'صباحاً (9 – 12)', labelEn: 'Morning (9 AM – 12 PM)' },
  { id: 'afternoon', from: '12:00', to: '17:00', labelAr: 'ظهراً (12 – 5)', labelEn: 'Afternoon (12 – 5 PM)' },
  { id: 'evening', from: '17:00', to: '21:00', labelAr: 'مساءً (5 – 9)', labelEn: 'Evening (5 – 9 PM)' },
];

export const RETURN_ITEM_CONDITIONS = [
  { id: 'unopened', labelAr: 'غير مفتوح / مغلق', labelEn: 'Unopened / sealed' },
  { id: 'opened', labelAr: 'مفتوح لكن بحالة جيدة', labelEn: 'Opened but in good condition' },
  { id: 'damaged', labelAr: 'تالف أو غير صالح', labelEn: 'Damaged or not usable' },
];

export function getReturnPickupSlot(slotId) {
  return RETURN_PICKUP_SLOTS.find((s) => s.id === slotId) || null;
}

export function getReturnMethod(methodId) {
  return RETURN_METHODS.find((m) => m.id === methodId) || null;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Validate customer/admin pickup schedule against return window.
 * @param {{ pickupDate: string, pickupSlotId: string, returnMethod?: string, contactPhone?: string, itemCondition?: string }} body
 * @param {{ maxPickupDate?: Date|null }} options
 */
export function parseReturnPickup(body, { maxPickupDate = null } = {}) {
  const pickupDateStr = (body.pickupDate || '').trim();
  const slotId = (body.pickupSlotId || '').trim();
  const methodId = (body.returnMethod || 'store_dropoff').trim();
  const itemCondition = (body.itemCondition || 'unopened').trim();
  const contactPhone = (body.contactPhone || '').trim();

  if (!pickupDateStr) {
    return { ok: false, message: 'Please choose a return date' };
  }

  const slot = getReturnPickupSlot(slotId);
  if (!slot) {
    return { ok: false, message: 'Please choose a return time slot' };
  }

  const method = getReturnMethod(methodId);
  if (!method) {
    return { ok: false, message: 'Invalid return method' };
  }

  const condition = RETURN_ITEM_CONDITIONS.find((c) => c.id === itemCondition);
  if (!condition) {
    return { ok: false, message: 'Invalid product condition' };
  }

  const parts = pickupDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return { ok: false, message: 'Invalid return date' };
  }
  const pickupDay = startOfLocalDay(new Date(parts[0], parts[1] - 1, parts[2]));
  if (Number.isNaN(pickupDay.getTime())) {
    return { ok: false, message: 'Invalid return date' };
  }

  const today = startOfLocalDay(new Date());
  if (pickupDay < today) {
    return { ok: false, message: 'Return date cannot be in the past' };
  }

  if (maxPickupDate) {
    const maxDay = startOfLocalDay(maxPickupDate);
    if (pickupDay > maxDay) {
      return { ok: false, message: 'Return date is outside the allowed return window' };
    }
  }

  return {
    ok: true,
    returnMethod: method.id,
    pickupDate: pickupDay,
    pickupSlotId: slot.id,
    pickupSlotFrom: slot.from,
    pickupSlotTo: slot.to,
    pickupSlotLabelAr: slot.labelAr,
    pickupSlotLabelEn: slot.labelEn,
    itemCondition: condition.id,
    itemConditionLabelAr: condition.labelAr,
    itemConditionLabelEn: condition.labelEn,
    contactPhone,
  };
}
