const SESSION_DISMISS_KEY = 'mp_location_gate_dismissed';

/** True when the visitor closed the (non-mandatory) location popup this session. */
export function isLocationGateDismissedThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLocationGateDismissed() {
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
  } catch {
    // ignore — private mode / storage disabled
  }
}

/**
 * Label to show as the customer's delivery location.
 * A precise pin dropped in the startup popup (map/GPS) wins over the admin zone
 * name — the zone is still resolved silently for pricing/products/slots.
 * A manually typed address (via "إدخال يدوي" in the popup) is likewise the
 * customer's own choice and wins over the zone label.
 * @param {{ formattedAddress?: string }|null} pin
 * @param {string} zoneName  admin zone label in the active language
 * @param {boolean} isAr
 * @param {{ formattedAddress?: string, street?: string, area?: string, city?: string }|null} [manualAddress]
 */
export function deliveryLocationLabel(pin, zoneName, isAr, manualAddress) {
  if (pin) {
    const addr = pin.formattedAddress?.trim();
    if (addr) return addr;
    return isAr ? 'موقعك المحدَّد على الخريطة' : 'Your pinned location';
  }
  if (manualAddress) {
    const label = manualAddress.formattedAddress?.trim()
      || [manualAddress.street, manualAddress.area, manualAddress.city]
        .filter(Boolean)
        .join(isAr ? '، ' : ', ');
    if (label) return label;
  }
  return zoneName;
}
