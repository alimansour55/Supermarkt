/** Whether map pin + live GPS delivery features are enabled for this store. */
export function isGpsDeliveryEnabled(settings) {
  return settings?.gpsDeliveryEnabled !== false;
}
