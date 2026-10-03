/**
 * Shared order fulfillment flow — must match backend/src/constants/orderStatuses.js
 */

/** Icons shown on the progress line (customer + admin) */
export const TIMELINE_ICONS = {
  received: '📥',
  preparing: '📦',
  out_for_delivery: '🚗',
  delivered: '✅',
  delivery_failed: '❌',
  upcoming: '📍',
};

export const ORDER_FLOW_STEPS = [
  {
    step: 'received',
    value: 'pending',
    statuses: ['pending'],
    labelAr: 'تم استلام الطلب',
    labelEn: 'Order Received',
    timelineIcon: TIMELINE_ICONS.received,
    emoji: '🟡',
    ring: 'ring-amber-400',
    bgActive: 'bg-amber-50',
    bgDone: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
  },
  {
    step: 'preparing',
    value: 'preparing',
    statuses: ['confirmed', 'preparing'],
    labelAr: 'جاري التحضير',
    labelEn: 'Preparing',
    timelineIcon: TIMELINE_ICONS.preparing,
    emoji: '🔵',
    ring: 'ring-blue-500',
    bgActive: 'bg-blue-50',
    bgDone: 'bg-blue-600',
    border: 'border-blue-500',
    text: 'text-blue-900',
    dot: 'bg-blue-600',
  },
  {
    step: 'out_for_delivery',
    value: 'out_for_delivery',
    statuses: ['out_for_delivery'],
    labelAr: 'في الطريق إليك',
    labelEn: 'Out for Delivery',
    timelineIcon: TIMELINE_ICONS.out_for_delivery,
    emoji: '🟣',
    ring: 'ring-purple-500',
    bgActive: 'bg-purple-50',
    bgDone: 'bg-purple-600',
    border: 'border-purple-500',
    text: 'text-purple-900',
    dot: 'bg-purple-600',
  },
];

export const ORDER_OUTCOMES = [
  {
    value: 'delivered',
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    emoji: '🟢',
    ring: 'ring-green-500',
    bgActive: 'bg-green-50',
    bgDone: 'bg-green-600',
    border: 'border-green-500',
    text: 'text-green-900',
    dot: 'bg-green-600',
  },
  {
    value: 'delivery_failed',
    labelAr: 'فشل التسليم',
    labelEn: 'Delivery Failed',
    emoji: '🔴',
    ring: 'ring-red-500',
    bgActive: 'bg-red-50',
    bgDone: 'bg-red-600',
    border: 'border-red-500',
    text: 'text-red-900',
    dot: 'bg-red-600',
  },
];

export const ORDER_STATUS_MAP = {
  pending: { ar: 'تم استلام الطلب', en: 'Order Received', color: 'bg-amber-100 text-amber-800' },
  confirmed: { ar: 'جاري التحضير', en: 'Preparing', color: 'bg-blue-100 text-blue-800' },
  preparing: { ar: 'جاري التحضير', en: 'Preparing', color: 'bg-blue-100 text-blue-800' },
  out_for_delivery: { ar: 'في الطريق إليك', en: 'Out for Delivery', color: 'bg-purple-100 text-purple-800' },
  delivered: { ar: 'تم التسليم', en: 'Delivered', color: 'bg-green-100 text-green-800' },
  delivery_failed: { ar: 'فشل التسليم', en: 'Delivery Failed', color: 'bg-red-100 text-red-800' },
  returned: { ar: 'تم الاسترجاع', en: 'Returned', color: 'bg-teal-100 text-teal-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', color: 'bg-slate-100 text-slate-700' },
};

export const ORDER_STATUSES = Object.entries(ORDER_STATUS_MAP).map(([value, labels]) => ({
  value,
  labelAr: labels.ar,
  labelEn: labels.en,
  color: labels.color,
}));

export function normalizeOrderStatus(status) {
  if (status === 'confirmed') return 'preparing';
  return status;
}

export function orderFlowStepIndex(orderStatus) {
  if (orderStatus === 'cancelled') return -1;
  if (orderStatus === 'delivered' || orderStatus === 'delivery_failed') {
    return ORDER_FLOW_STEPS.length;
  }
  const idx = ORDER_FLOW_STEPS.findIndex((step) => step.statuses.includes(orderStatus));
  return idx >= 0 ? idx : 0;
}

/** Four points on the progress line (steps 1–3 + delivery outcome) */
export function getTimelinePoints(orderStatus, isAr) {
  const isOutcome = orderStatus === 'delivered' || orderStatus === 'delivery_failed';
  const outcome = ORDER_OUTCOMES.find((o) => o.value === orderStatus);

  const steps = ORDER_FLOW_STEPS.map((step) => ({
    key: step.step,
    label: isAr ? step.labelAr : step.labelEn,
    icon: step.timelineIcon,
    tone: step.dot,
    ring: step.ring,
    text: step.text,
    bgActive: step.bgActive,
    bgDone: step.bgDone,
  }));

  const resolved = isOutcome ? outcome : null;
  const upcoming = {
    ring: 'ring-slate-200',
    text: 'text-slate-400',
    bgActive: 'bg-slate-50',
    bgDone: 'bg-slate-300',
  };

  steps.push({
    key: 'outcome',
    label: isOutcome && outcome
      ? (isAr ? outcome.labelAr : outcome.labelEn)
      : (isAr ? 'تم التسليم' : 'Delivered'),
    icon: isOutcome
      ? (orderStatus === 'delivered' ? TIMELINE_ICONS.delivered : TIMELINE_ICONS.delivery_failed)
      : TIMELINE_ICONS.upcoming,
    tone: resolved?.dot || upcoming.bgDone,
    ring: resolved?.ring || upcoming.ring,
    text: resolved?.text || upcoming.text,
    bgActive: resolved?.bgActive || upcoming.bgActive,
    bgDone: resolved?.bgDone || upcoming.bgDone,
  });

  return steps;
}

export function getTimelineProgressIndex(orderStatus) {
  const idx = orderFlowStepIndex(orderStatus);
  if (idx < 0) return 0;
  return Math.min(idx, ORDER_FLOW_STEPS.length);
}

/** @deprecated use orderFlowStepIndex */
export const orderTimelineIndex = orderFlowStepIndex;

export function getOrderStatusLabel(status, isAr) {
  const entry = ORDER_STATUS_MAP[status] || ORDER_STATUS_MAP.pending;
  return isAr ? entry.ar : entry.en;
}

export function getOrderStatusColor(status) {
  return (ORDER_STATUS_MAP[status] || ORDER_STATUS_MAP.pending).color;
}

export function getOrderStatusEntry(value) {
  const entry = ORDER_STATUS_MAP[value] || ORDER_STATUS_MAP.pending;
  return {
    value,
    labelAr: entry.ar,
    labelEn: entry.en,
    color: entry.color,
  };
}

export function getOrderStatusMeta(value) {
  const outcome = ORDER_OUTCOMES.find((s) => s.value === value);
  if (outcome) return outcome;
  const step = ORDER_FLOW_STEPS.find((s) => s.statuses.includes(value) || s.value === normalizeOrderStatus(value));
  if (step) return step;
  if (value === 'cancelled') {
    return { value: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled', emoji: '⚫' };
  }
  return ORDER_FLOW_STEPS[0];
};

/** Only these statuses can be moved to the recycle bin — mirrors the backend's
 * TRASHABLE_STATUSES guard in orderTrash.service.js. */
export const TRASHABLE_STATUSES = ['delivered', 'delivery_failed', 'cancelled', 'returned'];

export const ORDER_STATUS_CHART_COLORS = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#3b82f6',
  out_for_delivery: '#a855f7',
  delivered: '#22c55e',
  delivery_failed: '#ef4444',
  returned: '#14b8a6',
  cancelled: '#64748b',
};
