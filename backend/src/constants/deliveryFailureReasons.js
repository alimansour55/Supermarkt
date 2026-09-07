export const DELIVERY_FAILURE_PRESETS = [
  {
    key: 'could_not_reach',
    labelAr: 'تعذّر على مندوب التوصيل الوصول إليك',
    labelEn: 'The delivery person could not reach you',
  },
  {
    key: 'wrong_address',
    labelAr: 'العنوان غير صحيح أو غير مكتمل',
    labelEn: 'The address is incorrect or incomplete',
  },
  {
    key: 'customer_unavailable',
    labelAr: 'لم يكن العميل متاحاً لاستلام الطلب',
    labelEn: 'Customer was not available to receive the order',
  },
  {
    key: 'refused',
    labelAr: 'تم رفض استلام الطلب',
    labelEn: 'Delivery was refused',
  },
  {
    key: 'unsafe_access',
    labelAr: 'تعذّر الوصول إلى المبنى أو المنطقة',
    labelEn: 'Could not access the building or area',
  },
];

export function getDeliveryFailurePreset(key) {
  return DELIVERY_FAILURE_PRESETS.find((p) => p.key === key) || null;
}

export function applyDeliveryFailureReason(order, { deliveryFailureReasonKey, deliveryFailureReason }) {
  const key = (deliveryFailureReasonKey || '').trim();
  const custom = (deliveryFailureReason || '').trim();

  if (key && key !== 'custom') {
    const preset = getDeliveryFailurePreset(key);
    if (!preset) {
      return { ok: false, message: 'Invalid delivery failure reason' };
    }
    order.deliveryFailureReasonKey = key;
    order.deliveryFailureReasonAr = preset.labelAr;
    order.deliveryFailureReasonEn = preset.labelEn;
    return { ok: true };
  }

  if (!custom || custom.length < 3) {
    return { ok: false, message: 'Please provide a delivery failure reason (at least 3 characters)' };
  }

  order.deliveryFailureReasonKey = 'custom';
  order.deliveryFailureReasonAr = custom;
  order.deliveryFailureReasonEn = custom;
  return { ok: true };
}

export function clearDeliveryFailureReason(order) {
  order.deliveryFailureReasonKey = '';
  order.deliveryFailureReasonAr = '';
  order.deliveryFailureReasonEn = '';
}

export function getDeliveryFailureReasonForLang(order, lang = 'ar') {
  if (!order?.deliveryFailureReasonKey) return '';
  return lang === 'ar'
    ? (order.deliveryFailureReasonAr || order.deliveryFailureReasonEn || '')
    : (order.deliveryFailureReasonEn || order.deliveryFailureReasonAr || '');
}
