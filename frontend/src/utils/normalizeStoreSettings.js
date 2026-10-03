/** Apply client-side defaults to the public store settings payload (shared by SSR and browser). */
export function normalizeStoreSettings(settings) {
  if (!settings) return settings;
  return {
    ...settings,
    aiChatEnabled: settings.aiChatEnabled !== false,
    gpsDeliveryEnabled: settings.gpsDeliveryEnabled !== false,
    freeDeliveryEnabled: settings.freeDeliveryEnabled !== false,
    liveChat: { enabled: true, available: true, nextAvailableAt: null, ...(settings.liveChat || {}) },
  };
}
