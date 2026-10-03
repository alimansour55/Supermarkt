/**
 * Checkout payment methods.
 *
 *   paymob_card    — Visa / Mastercard / Meeza (+ Apple Pay on Apple devices) via Paymob
 *   paymob_wallet  — mobile wallets (Vodafone Cash, Orange, Etisalat, WE Pay, …) via Paymob
 *   paymob_valu    — valU instalments via Paymob
 *   fawry          — FawryPay reference number, paid at any Fawry outlet / myFawry app
 *   cod            — cash on delivery
 *   instapay / vodafone_cash — manual transfer + uploaded proof (reviewed by staff)
 *   stripe         — legacy; kept so historic orders keep working
 */
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

/** Methods paid through a gateway before fulfilment; value = gateway id. */
export const PAYMENT_PROVIDER_BY_METHOD = {
  paymob_card: 'paymob',
  paymob_wallet: 'paymob',
  paymob_valu: 'paymob',
  fawry: 'fawry',
  stripe: 'stripe',
};

export const ONLINE_PAYMENT_METHODS = Object.keys(PAYMENT_PROVIDER_BY_METHOD);

/** Bilingual fallback labels (store settings labels win when present). */
export const PAYMENT_METHOD_LABELS = {
  paymob_card: { ar: 'بطاقة بنكية / Apple Pay', en: 'Card / Apple Pay' },
  paymob_wallet: { ar: 'محفظة إلكترونية', en: 'Mobile wallet' },
  paymob_valu: { ar: 'valU تقسيط', en: 'valU instalments' },
  fawry: { ar: 'فوري', en: 'Fawry' },
  cod: { ar: 'الدفع عند الاستلام', en: 'Cash on delivery' },
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  vodafone_cash: { ar: 'فودافون كاش (تحويل)', en: 'Vodafone Cash (transfer)' },
  stripe: { ar: 'دفع أونلاين', en: 'Online payment' },
};

export function isValidPaymentMethod(id) {
  return PAYMENT_METHOD_IDS.includes(String(id || '').trim().toLowerCase());
}

export function requiresPaymentProof(id) {
  return MANUAL_TRANSFER_PAYMENT_METHODS.includes(String(id || '').trim().toLowerCase());
}

export function isOnlinePaymentMethod(id) {
  return ONLINE_PAYMENT_METHODS.includes(String(id || '').trim().toLowerCase());
}

export function paymentProviderFor(id) {
  return PAYMENT_PROVIDER_BY_METHOD[String(id || '').trim().toLowerCase()] || null;
}

export function paymentMethodLabel(id, lang = 'ar') {
  const label = PAYMENT_METHOD_LABELS[id];
  if (!label) return id || '';
  return lang === 'en' ? label.en : label.ar;
}

export function normalizePaymentMethodId(id) {
  const normalized = String(id || 'cod').trim().toLowerCase();
  return isValidPaymentMethod(normalized) ? normalized : 'cod';
}
