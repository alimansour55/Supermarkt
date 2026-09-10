import StoreSettings from '../models/StoreSettings.js';
import { DEFAULT_DRIVER_SETTINGS } from '../constants/storeDefaults.js';

const SETTINGS_KEY = 'main';
const CACHE_MS = 30_000;

function freshCache() {
  return {
    at: 0,
    gpsDeliveryEnabled: true,
    aiChatEnabled: true,
    driverSettings: { ...DEFAULT_DRIVER_SETTINGS },
  };
}

let cache = freshCache();

export function invalidateStoreSettingsCache() {
  cache = freshCache();
}

export function isGpsDeliveryEnabledFromSettings(settings) {
  return settings?.gpsDeliveryEnabled !== false;
}

export function isAiChatEnabledFromSettings(settings) {
  return settings?.aiChatEnabled !== false;
}

export function resolveDriverSettings(settings) {
  const raw = settings?.driverSettings?.toObject?.() || settings?.driverSettings || {};
  return { ...DEFAULT_DRIVER_SETTINGS, ...raw };
}

async function refreshSettingsFlagsCache() {
  const settings = await StoreSettings.findOne({ key: SETTINGS_KEY })
    .select('gpsDeliveryEnabled aiChatEnabled driverSettings')
    .lean();

  cache = {
    at: Date.now(),
    gpsDeliveryEnabled: isGpsDeliveryEnabledFromSettings(settings),
    aiChatEnabled: isAiChatEnabledFromSettings(settings),
    driverSettings: resolveDriverSettings(settings),
  };
  return cache;
}

async function getCached() {
  if (cache.at && Date.now() - cache.at < CACHE_MS) {
    return cache;
  }
  return refreshSettingsFlagsCache();
}

export async function getGpsDeliveryEnabled() {
  return (await getCached()).gpsDeliveryEnabled;
}

export async function getAiChatEnabled() {
  return (await getCached()).aiChatEnabled;
}

export async function getDriverSettings() {
  return (await getCached()).driverSettings;
}
