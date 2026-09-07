import StoreSettings from '../models/StoreSettings.js';

const SETTINGS_KEY = 'main';
const CACHE_MS = 30_000;

let cache = { at: 0, gpsDeliveryEnabled: true, aiChatEnabled: true };

export function invalidateStoreSettingsCache() {
  cache = { at: 0, gpsDeliveryEnabled: true, aiChatEnabled: true };
}

export function isGpsDeliveryEnabledFromSettings(settings) {
  return settings?.gpsDeliveryEnabled !== false;
}

export function isAiChatEnabledFromSettings(settings) {
  return settings?.aiChatEnabled !== false;
}

async function refreshSettingsFlagsCache() {
  const settings = await StoreSettings.findOne({ key: SETTINGS_KEY })
    .select('gpsDeliveryEnabled aiChatEnabled')
    .lean();

  cache = {
    at: Date.now(),
    gpsDeliveryEnabled: isGpsDeliveryEnabledFromSettings(settings),
    aiChatEnabled: isAiChatEnabledFromSettings(settings),
  };
  return cache;
}

export async function getGpsDeliveryEnabled() {
  if (cache.at && Date.now() - cache.at < CACHE_MS) {
    return cache.gpsDeliveryEnabled;
  }
  return (await refreshSettingsFlagsCache()).gpsDeliveryEnabled;
}

export async function getAiChatEnabled() {
  if (cache.at && Date.now() - cache.at < CACHE_MS) {
    return cache.aiChatEnabled;
  }
  return (await refreshSettingsFlagsCache()).aiChatEnabled;
}
