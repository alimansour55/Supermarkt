import api from './api';
import { initApiConnection } from '../utils/initApiConnection';

async function ensureApiReady() {
  await initApiConnection();
}

export async function createCallbackRequest({ name, phone, note = '', source = 'contact_page' }) {
  await ensureApiReady();
  try {
    const { data } = await api.post('/support/callback-requests', { name, phone, note, source });
    return data?.data;
  } catch (err) {
    const apiError = new Error(err.response?.data?.message || err.message || 'Callback request failed');
    apiError.status = err.response?.status;
    throw apiError;
  }
}
