export const PAYMENT_METHOD_IDS = ['stripe', 'cod', 'instapay', 'vodafone_cash'];

export const MANUAL_TRANSFER_PAYMENT_METHODS = ['instapay', 'vodafone_cash'];

export function requiresPaymentProof(methodId) {
  return MANUAL_TRANSFER_PAYMENT_METHODS.includes(String(methodId || '').trim().toLowerCase());
}

export function requiresAccountNumbers(methodId) {
  return requiresPaymentProof(methodId);
}

export function getPaymentMethodConfig(settings, methodId) {
  return (settings?.paymentMethods || []).find((method) => method.id === methodId) || null;
}

export function getEnabledPaymentMethods(settings) {
  return (settings?.paymentMethods || [])
    .filter((method) => method.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getPaymentMethodLabel(methodId, settings, isAr) {
  const config = getPaymentMethodConfig(settings, methodId);
  if (config) return isAr ? config.labelAr : config.labelEn;

  const fallback = {
    stripe: isAr ? 'دفع أونلاين' : 'Online payment',
    cod: isAr ? 'الدفع عند الاستلام' : 'Cash on Delivery',
    instapay: 'Instapay',
    vodafone_cash: isAr ? 'فودافون كاش' : 'Vodafone Cash',
  };
  return fallback[methodId] || methodId;
}
