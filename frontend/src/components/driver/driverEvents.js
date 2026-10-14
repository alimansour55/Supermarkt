/** Fired by driver pages after pickup / complete / fail so the layout re-checks active orders. */
export const DRIVER_DELIVERIES_CHANGED = 'driver:deliveries-changed';

export function notifyDeliveriesChanged() {
  window.dispatchEvent(new Event(DRIVER_DELIVERIES_CHANGED));
}
