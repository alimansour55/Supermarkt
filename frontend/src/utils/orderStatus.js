/** Storefront order status labels (aligned with backend orderStatus enum). */
export const ORDER_STATUS_MAP = {
  pending: { ar: 'قيد الانتظار', en: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', color: 'bg-green-100 text-green-800' },
  preparing: { ar: 'جاري التجهيز', en: 'Preparing', color: 'bg-blue-100 text-blue-800' },
  out_for_delivery: { ar: 'في الطريق', en: 'Out for delivery', color: 'bg-purple-100 text-purple-800' },
  delivered: { ar: 'تم التوصيل', en: 'Delivered', color: 'bg-green-100 text-green-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export const ORDER_TIMELINE = [
  { step: 'placed', statuses: ['pending'], labelEn: 'Placed', labelAr: 'تم الطلب' },
  { step: 'confirmed', statuses: ['confirmed', 'preparing'], labelEn: 'Confirmed', labelAr: 'مؤكد' },
  { step: 'shipped', statuses: ['out_for_delivery'], labelEn: 'Shipped', labelAr: 'تم الشحن' },
  { step: 'delivered', statuses: ['delivered'], labelEn: 'Delivered', labelAr: 'تم التسليم' },
];

export function orderTimelineIndex(orderStatus) {
  if (orderStatus === 'cancelled') return -1;
  const idx = ORDER_TIMELINE.findIndex((step) => step.statuses.includes(orderStatus));
  return idx >= 0 ? idx : 0;
}

export function getOrderStatusLabel(status, isAr) {
  const entry = ORDER_STATUS_MAP[status] || ORDER_STATUS_MAP.pending;
  return isAr ? entry.ar : entry.en;
}

export function getOrderStatusColor(status) {
  return (ORDER_STATUS_MAP[status] || ORDER_STATUS_MAP.pending).color;
}
