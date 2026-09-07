export const PAYMENT_METHOD_IDS = ['stripe', 'cod', 'instapay', 'vodafone_cash'];

export const MANUAL_TRANSFER_PAYMENT_METHODS = ['instapay', 'vodafone_cash'];

export function isValidPaymentMethod(id) {
  return PAYMENT_METHOD_IDS.includes(String(id || '').trim().toLowerCase());
}

export function requiresPaymentProof(id) {
  return MANUAL_TRANSFER_PAYMENT_METHODS.includes(String(id || '').trim().toLowerCase());
}

export function normalizePaymentMethodId(id) {
  const normalized = String(id || 'cod').trim().toLowerCase();
  return isValidPaymentMethod(normalized) ? normalized : 'cod';
}
