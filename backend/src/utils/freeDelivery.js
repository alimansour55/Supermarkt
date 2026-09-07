export const DELIVERY_METHOD_IDS = ['scheduled', 'express', 'recurring'];

export const DEFAULT_FREE_DELIVERY_METHODS = ['scheduled', 'recurring'];

/** Filter to valid method ids — may return an empty array. */
export function filterFreeDeliveryMethods(methods) {
  if (!Array.isArray(methods)) return [];
  return methods
    .map((m) => (typeof m === 'string' ? m : m?.value || m?.method || ''))
    .filter((m) => DELIVERY_METHOD_IDS.includes(m));
}

/** Admin save helper — never empty when configuring methods. */
export function normalizeFreeDeliveryMethods(methods) {
  const filtered = filterFreeDeliveryMethods(methods);
  return filtered.length ? filtered : [...DEFAULT_FREE_DELIVERY_METHODS];
}

/**
 * Resolve which delivery methods qualify for free delivery.
 * Zone override wins when enabled; otherwise global store settings apply.
 */
export function resolveFreeDeliveryMethods(zone = null, store = null) {
  const zoneOverride = zone?.freeDeliveryOverride === true;
  const globalEnabled = store?.freeDeliveryEnabled !== false;

  if (zoneOverride) {
    return filterFreeDeliveryMethods(zone?.freeDeliveryMethods);
  }
  if (globalEnabled) {
    return filterFreeDeliveryMethods(store?.freeDeliveryMethods);
  }
  return [];
}

export function isThresholdMet(subtotal, threshold, freeDeliveryFromCoupon = false) {
  return freeDeliveryFromCoupon || Number(subtotal || 0) >= Number(threshold || 0);
}

export function isFreeDeliveryForMethod({
  deliveryMethod,
  subtotal,
  threshold,
  freeDeliveryMethods,
  freeDeliveryFromCoupon = false,
}) {
  if (freeDeliveryFromCoupon) return true;
  if (!isThresholdMet(subtotal, threshold)) return false;
  const methods = Array.isArray(freeDeliveryMethods) ? freeDeliveryMethods : [];
  return methods.includes(deliveryMethod);
}

export function resolveDeliveryFee({
  deliveryMethod,
  subtotal,
  threshold,
  freeDeliveryMethods,
  freeDeliveryFromCoupon = false,
  scheduledFee = 29.99,
  expressFee = 49.99,
}) {
  if (isFreeDeliveryForMethod({
    deliveryMethod,
    subtotal,
    threshold,
    freeDeliveryMethods,
    freeDeliveryFromCoupon,
  })) {
    return 0;
  }

  if (deliveryMethod === 'express') return expressFee;
  if (deliveryMethod === 'scheduled' || deliveryMethod === 'recurring') return scheduledFee;
  return 0;
}
