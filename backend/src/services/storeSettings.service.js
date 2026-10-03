import StoreSettings from '../models/StoreSettings.js';
import { DEFAULT_DRIVER_SETTINGS, DEFAULT_LIVE_CHAT } from '../constants/storeDefaults.js';

const SETTINGS_KEY = 'main';
const CACHE_MS = 30_000;

function freshCache() {
  return {
    at: 0,
    gpsDeliveryEnabled: true,
    aiChatEnabled: true,
    driverSettings: { ...DEFAULT_DRIVER_SETTINGS },
    liveChat: { ...DEFAULT_LIVE_CHAT },
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

export function resolveLiveChatSettings(settings) {
  const raw = settings?.liveChat?.toObject?.() || settings?.liveChat || {};
  return { ...DEFAULT_LIVE_CHAT, ...raw };
}

async function refreshSettingsFlagsCache() {
  const settings = await StoreSettings.findOne({ key: SETTINGS_KEY })
    .select('gpsDeliveryEnabled aiChatEnabled driverSettings liveChat')
    .lean();

  cache = {
    at: Date.now(),
    gpsDeliveryEnabled: isGpsDeliveryEnabledFromSettings(settings),
    aiChatEnabled: isAiChatEnabledFromSettings(settings),
    driverSettings: resolveDriverSettings(settings),
    liveChat: resolveLiveChatSettings(settings),
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

export async function getLiveChatSettings() {
  return (await getCached()).liveChat;
}
