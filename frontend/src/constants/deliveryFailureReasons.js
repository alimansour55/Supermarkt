/** Keep in sync with backend/src/constants/deliveryFailureReasons.js */

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

export function getDeliveryFailureReason(order, isAr) {
  if (!order?.deliveryFailureReasonKey) return '';
  if (isAr) {
    return order.deliveryFailureReasonAr || order.deliveryFailureReasonEn || '';
  }
  return order.deliveryFailureReasonEn || order.deliveryFailureReasonAr || '';
}
