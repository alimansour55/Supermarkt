/** Keep in sync with backend/src/constants/paymentMethods.js */
export const PAYMENT_METHOD_IDS = [
  'paymob_card',
  'paymob_wallet',
  'paymob_valu',
  'fawry',
  'cod',
  'instapay',
  'vodafone_cash',
  'stripe',
];

export const MANUAL_TRANSFER_PAYMENT_METHODS = ['instapay', 'vodafone_cash'];

/** Paid through a gateway (hosted checkout or Fawry reference) before fulfilment. */
export const GATEWAY_PAYMENT_METHODS = ['paymob_card', 'paymob_wallet', 'paymob_valu', 'fawry'];

export function requiresPaymentProof(methodId) {
  return MANUAL_TRANSFER_PAYMENT_METHODS.includes(String(methodId || '').trim().toLowerCase());
}

export function requiresAccountNumbers(methodId) {
  return requiresPaymentProof(methodId);
}

export function isGatewayPaymentMethod(methodId) {
  return GATEWAY_PAYMENT_METHODS.includes(String(methodId || '').trim().toLowerCase());
}

export function getPaymentMethodConfig(settings, methodId) {
  return (settings?.paymentMethods || []).find((method) => method.id === methodId) || null;
}

export function getEnabledPaymentMethods(settings) {
  return (settings?.paymentMethods || [])
    .filter((method) => method.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

const FALLBACK_LABELS = {
  paymob_card: ['بطاقة بنكية / Apple Pay', 'Card / Apple Pay'],
  paymob_wallet: ['محفظة إلكترونية', 'Mobile wallet'],
  paymob_valu: ['valU تقسيط', 'valU instalments'],
  fawry: ['فوري', 'Fawry'],
  cod: ['الدفع عند الاستلام', 'Cash on Delivery'],
  instapay: ['Instapay', 'Instapay'],
  vodafone_cash: ['فودافون كاش', 'Vodafone Cash'],
  stripe: ['دفع أونلاين', 'Online payment'],
};

export function getPaymentMethodLabel(methodId, settings, isAr) {
  const config = getPaymentMethodConfig(settings, methodId);
  if (config) return isAr ? config.labelAr : config.labelEn;
  const fallback = FALLBACK_LABELS[methodId];
  if (fallback) return isAr ? fallback[0] : fallback[1];
  return methodId;
}
