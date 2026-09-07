import api from './api';
import { initApiConnection } from '../utils/initApiConnection';

async function ensureApiReady() {
  await initApiConnection();
}

export async function fetchAssistantStatus() {
  await ensureApiReady();
  const { data } = await api.get('/assistant/status');
  return data?.data ?? { enabled: false };
}

export async function sendAssistantMessage({ message, history = [], locale = 'ar' }) {
  await ensureApiReady();
  try {
    const { data } = await api.post(
      '/assistant/chat',
      { message, history, locale },
      { timeout: 60_000 },
    );
    return data?.data;
  } catch (err) {
    const apiError = new Error(err.response?.data?.message || err.message || 'Assistant request failed');
    apiError.status = err.response?.status;
    throw apiError;
  }
}
