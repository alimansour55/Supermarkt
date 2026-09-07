import api from './api';

export async function fetchStoreSettings() {
  const { data } = await api.get('/store-settings');
  const settings = data.data;
  if (!settings) return settings;
  return {
    ...settings,
    aiChatEnabled: settings.aiChatEnabled !== false,
    gpsDeliveryEnabled: settings.gpsDeliveryEnabled !== false,
    freeDeliveryEnabled: settings.freeDeliveryEnabled !== false,
  };
}
