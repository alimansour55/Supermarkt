/** Canonical order statuses — keep in sync with Order schema enum and frontend orderFlow.js */

export const ORDER_FLOW_STEPS = [
  {
    step: 'received',
    value: 'pending',
    statuses: ['pending'],
    labelAr: 'تم استلام الطلب',
    labelEn: 'Order Received',
    emoji: '🟡',
    color: 'amber',
  },
  {
    step: 'preparing',
    value: 'preparing',
    statuses: ['confirmed', 'preparing'],
    labelAr: 'جاري التحضير',
    labelEn: 'Preparing',
    emoji: '🔵',
    color: 'blue',
  },
  {
    step: 'out_for_delivery',
    value: 'out_for_delivery',
    statuses: ['out_for_delivery'],
    labelAr: 'في الطريق إليك',
    labelEn: 'Out for Delivery',
    emoji: '🟣',
    color: 'purple',
  },
];

export const ORDER_OUTCOME_STATUSES = [
  {
    value: 'delivered',
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    emoji: '🟢',
    color: 'green',
  },
  {
    value: 'delivery_failed',
    labelAr: 'فشل التسليم',
    labelEn: 'Delivery Failed',
    emoji: '🔴',
    color: 'red',
  },
];

export const ORDER_STATUSES = [
  ...ORDER_FLOW_STEPS.map((s) => ({
    value: s.value,
    labelAr: s.labelAr,
    labelEn: s.labelEn,
    emoji: s.emoji,
    color: s.color,
  })),
  ...ORDER_OUTCOME_STATUSES.map((s) => ({
    value: s.value,
    labelAr: s.labelAr,
    labelEn: s.labelEn,
    emoji: s.emoji,
    color: s.color,
  })),
  {
    value: 'confirmed',
    labelAr: 'جاري التحضير',
    labelEn: 'Preparing',
    emoji: '🔵',
    color: 'blue',
    legacy: true,
  },
  {
    value: 'returned',
    labelAr: 'تم الاسترجاع',
    labelEn: 'Returned',
    emoji: '🔄',
    color: 'teal',
  },
  {
    value: 'cancelled',
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    emoji: '⚫',
    color: 'slate',
  },
];

export const ORDER_STATUS_VALUES = [
  'pending',
  'preparing',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
  'confirmed',
];

export function normalizeOrderStatus(status) {
  if (status === 'confirmed') return 'preparing';
  return status;
}

export function orderFlowStepIndex(orderStatus) {
  if (orderStatus === 'cancelled') return -1;
  const normalized = normalizeOrderStatus(orderStatus);
  if (normalized === 'delivered' || normalized === 'delivery_failed') {
    return ORDER_FLOW_STEPS.length;
  }
  const idx = ORDER_FLOW_STEPS.findIndex((step) => step.statuses.includes(orderStatus));
  return idx >= 0 ? idx : 0;
}

export function getOrderStatusMeta(status) {
  const outcome = ORDER_OUTCOME_STATUSES.find((s) => s.value === status);
  if (outcome) return { ...outcome, type: 'outcome' };
  const step = ORDER_FLOW_STEPS.find((s) => s.statuses.includes(status) || s.value === normalizeOrderStatus(status));
  if (step) return { ...step, type: 'step' };
  if (status === 'returned') {
    return {
      value: 'returned',
      labelAr: 'تم الاسترجاع',
      labelEn: 'Returned',
      emoji: '🔄',
      color: 'teal',
      type: 'terminal',
    };
  }
  if (status === 'cancelled') {
    return {
      value: 'cancelled',
      labelAr: 'ملغي',
      labelEn: 'Cancelled',
      emoji: '⚫',
      color: 'slate',
      type: 'terminal',
    };
  }
  return ORDER_STATUSES[0];
}
