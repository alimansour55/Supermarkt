/** Return pickup options — keep in sync with backend returnPickup.js */

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

export function getReturnMethodLabel(methodId, isAr) {
  const row = RETURN_METHODS.find((m) => m.id === methodId);
  if (!row) return methodId || '—';
  return isAr ? row.labelAr : row.labelEn;
}

export function getPickupSlotLabel(ret, isAr) {
  if (!ret) return '—';
  if (isAr) return ret.pickupSlotLabelAr || ret.pickupSlotLabelEn || '';
  return ret.pickupSlotLabelEn || ret.pickupSlotLabelAr || '';
}

export function getItemConditionLabel(ret, isAr) {
  if (!ret) return '—';
  if (isAr) return ret.itemConditionLabelAr || ret.itemConditionLabelEn || '';
  return ret.itemConditionLabelEn || ret.itemConditionLabelAr || '';
}

/** YYYY-MM-DD for date input min (today). */
export function todayDateInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD max from return deadline or fallback days ahead. */
export function maxPickupDateInputValue(returnDeadline, fallbackDays = 3) {
  let max = returnDeadline ? new Date(returnDeadline) : new Date();
  if (!returnDeadline) {
    max.setDate(max.getDate() + fallbackDays);
  }
  const y = max.getFullYear();
  const m = String(max.getMonth() + 1).padStart(2, '0');
  const day = String(max.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
