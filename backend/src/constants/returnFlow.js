/** Return fulfillment steps — sync with frontend returnFlow.js */

export const RETURN_FLOW_STEPS = [
  {
    step: 'requested',
    value: 'requested',
    labelAr: 'طلب استرجاع',
    labelEn: 'Return requested',
    icon: '🔄',
  },
  {
    step: 'confirmed',
    value: 'confirmed',
    labelAr: 'تم التأكيد',
    labelEn: 'Confirmed',
    icon: '✅',
  },
  {
    step: 'pickup_en_route',
    value: 'pickup_en_route',
    labelAr: 'المندوب في الطريق إليك',
    labelEn: 'Agent on the way',
    icon: '🚗',
  },
  {
    step: 'completed',
    value: 'completed',
    labelAr: 'تم الاسترجاع',
    labelEn: 'Returned',
    icon: '✅',
  },
];

export const RETURN_FULFILLMENT_VALUES = RETURN_FLOW_STEPS.map((s) => s.value);

export function resolveReturnFulfillment(ret) {
  if (!ret) return 'requested';
  if (ret.status === 'rejected') return null;
  if (ret.status === 'pending') return 'requested';
  if (ret.fulfillmentStatus && RETURN_FULFILLMENT_VALUES.includes(ret.fulfillmentStatus)) {
    return ret.fulfillmentStatus;
  }
  if (ret.status === 'approved') return 'confirmed';
  return 'requested';
}

export function returnFlowStepIndex(fulfillmentStatus) {
  if (!fulfillmentStatus) return -1;
  const idx = RETURN_FLOW_STEPS.findIndex((s) => s.value === fulfillmentStatus);
  return idx >= 0 ? idx : 0;
}

export function getReturnFlowMeta(value) {
  return RETURN_FLOW_STEPS.find((s) => s.value === value) || RETURN_FLOW_STEPS[0];
}
