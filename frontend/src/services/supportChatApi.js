import api from './api';
import { initApiConnection } from '../utils/initApiConnection';

async function ensureApiReady() {
  await initApiConnection();
}

export async function getMySupportConversation() {
  await ensureApiReady();
  const { data } = await api.get('/support-chat/me');
  return data?.data;
}

export async function sendMySupportMessage(body) {
  await ensureApiReady();
  const { data } = await api.post('/support-chat/me/messages', { body });
  return data?.data || { messages: [] };
}

export async function endMySupportConversation() {
  await ensureApiReady();
  const { data } = await api.post('/support-chat/me/close');
  return data?.data;
}

export async function getMySupportHistory() {
  await ensureApiReady();
  const { data } = await api.get('/support-chat/me/history');
  return data?.data || [];
}

export async function rateSupportConversation(id, { score, comment = '' }) {
  await ensureApiReady();
  const { data } = await api.post(`/support-chat/me/${id}/rate`, { score, comment });
  return data?.data;
}

export async function keepMySupportConversationAlive() {
  await ensureApiReady();
  const { data } = await api.post('/support-chat/me/keepalive');
  return data?.data;
}
