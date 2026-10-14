import api from '../services/api';

const SW_URL = '/driver-sw.js';
const SW_SCOPE = '/driver';

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** 'unsupported' | 'disabled' (server has no keys) | 'denied' | 'on' | 'off' */
export async function getDriverPushState() {
  if (!isPushSupported()) return 'unsupported';
  const { data } = await api.get('/push/config');
  if (!data.data?.enabled) return 'disabled';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

/** Ask permission, subscribe this browser, and register it with the API. */
export async function enableDriverPush() {
  const { data } = await api.get('/push/config');
  if (!data.data?.enabled) return 'disabled';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.data.publicKey),
  });
  await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  return 'on';
}

export async function disableDriverPush() {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}
