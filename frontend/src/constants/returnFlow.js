/** Return fulfillment flow — sync with backend returnFlow.js */

export const RETURN_FLOW_STEPS = [
  {
    step: 'requested',
    value: 'requested',
    labelAr: 'طلب استرجاع',
    labelEn: 'Return requested',
    timelineIcon: '🔄',
    ring: 'ring-amber-400',
    bgActive: 'bg-amber-50',
    bgDone: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
  },
  {
    step: 'confirmed',
    value: 'confirmed',
    labelAr: 'تم التأكيد',
    labelEn: 'Confirmed',
    timelineIcon: '✅',
    ring: 'ring-blue-500',
    bgActive: 'bg-blue-50',
    bgDone: 'bg-blue-600',
    border: 'border-blue-500',
    text: 'text-blue-900',
    dot: 'bg-blue-600',
  },
  {
    step: 'pickup_en_route',
    value: 'pickup_en_route',
    labelAr: 'المندوب في الطريق إليك',
    labelEn: 'Agent on the way',
    timelineIcon: '🚗',
    ring: 'ring-purple-500',
    bgActive: 'bg-purple-50',
    bgDone: 'bg-purple-600',
    border: 'border-purple-500',
    text: 'text-purple-900',
    dot: 'bg-purple-600',
  },
  {
    step: 'completed',
    value: 'completed',
    labelAr: 'تم الاسترجاع',
    labelEn: 'Returned',
    timelineIcon: '✅',
    ring: 'ring-green-500',
    bgActive: 'bg-green-50',
    bgDone: 'bg-green-600',
    border: 'border-green-500',
    text: 'text-green-900',
    dot: 'bg-green-600',
  },
];

export function resolveReturnFulfillment(ret) {
  if (!ret) return 'requested';
  if (ret.status === 'rejected') return null;
  if (ret.fulfillmentStatus) return ret.fulfillmentStatus;
  if (ret.status === 'pending') return 'requested';
  if (ret.status === 'approved') return 'confirmed';
  return 'requested';
}

export function returnFlowStepIndex(ret) {
  const fulfillment = resolveReturnFulfillment(ret);
  if (!fulfillment) return -1;
  const idx = RETURN_FLOW_STEPS.findIndex((s) => s.value === fulfillment);
  return idx >= 0 ? idx : 0;
}

export function getReturnTimelinePoints(ret, isAr) {
  const fulfillment = resolveReturnFulfillment(ret);
  const activeIdx = returnFlowStepIndex(ret);
  return RETURN_FLOW_STEPS.map((step, index) => ({
    key: step.step,
    value: step.value,
    label: isAr ? step.labelAr : step.labelEn,
    icon: step.timelineIcon,
    ring: step.ring,
    text: step.text,
    bgActive: step.bgActive,
    bgDone: step.bgDone,
    completed: activeIdx >= 0 && index < activeIdx,
    active: activeIdx >= 0 && index === activeIdx,
    upcoming: activeIdx >= 0 && index > activeIdx,
    fulfillment,
  }));
}

export function getReturnFlowLabel(ret, isAr) {
  const fulfillment = resolveReturnFulfillment(ret);
  if (!fulfillment) {
    return isAr ? 'مرفوض' : 'Rejected';
  }
  const step = RETURN_FLOW_STEPS.find((s) => s.value === fulfillment);
  return step ? (isAr ? step.labelAr : step.labelEn) : '';
}
