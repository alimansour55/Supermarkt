import api from './api';
import { normalizeStoreSettings } from '../utils/normalizeStoreSettings';

export async function fetchStoreSettings() {
  const { data } = await api.get('/store-settings');
  return normalizeStoreSettings(data.data);
}
