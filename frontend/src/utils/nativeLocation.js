import { Capacitor } from '@capacitor/core';

/** True only inside the Capacitor iOS/Android wrapper, never in a normal browser. */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/**
 * Ask the OS for location permission. Returns 'granted' | 'denied' | 'prompt'.
 * On denial iOS/Android won't show the prompt again, so the caller should offer
 * openAppSettings() — this is the flow native apps like Teams use.
 */
export async function requestNativeLocationPermission() {
  const { Geolocation } = await import('@capacitor/geolocation');
  const current = await Geolocation.checkPermissions();
  if (current.location === 'granted' || current.coarseLocation === 'granted') return 'granted';
  if (current.location === 'denied') return 'denied';
  const next = await Geolocation.requestPermissions();
  return next.location === 'granted' || next.coarseLocation === 'granted' ? 'granted' : next.location;
}

/** Jump straight to this app's page in the OS Settings app. */
export async function openAppSettings() {
  const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings');
  await NativeSettings.open({
    optionAndroid: AndroidSettings.ApplicationDetails,
    optionIOS: IOSSettings.App,
  });
}

/** Run cb whenever the user returns to the app (e.g. after toggling Location in Settings). */
export async function onAppResume(cb) {
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('resume', cb);
  return () => handle.remove();
}
