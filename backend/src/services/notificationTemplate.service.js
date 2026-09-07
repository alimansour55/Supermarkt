import NotificationTemplate from '../models/NotificationTemplate.js';
import { DEFAULT_NOTIFICATION_TEMPLATES } from '../constants/notificationTemplates.js';

export function applyPlaceholders(text, data = {}) {
  if (!text) return text;
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    return value != null ? String(value) : '';
  });
}

export async function getNotificationTemplate(key, channel = 'email') {
  return NotificationTemplate.findOne({ key, channel, isActive: true }).lean();
}

export async function renderEmailTemplate(key, lang, data) {
  const template = await getNotificationTemplate(key, 'email');
  if (!template) return null;

  const suffix = lang === 'ar' ? 'Ar' : 'En';
  const subject = applyPlaceholders(template[`subject${suffix}`], data);
  const html = applyPlaceholders(template[`bodyHtml${suffix}`], data);
  const text = applyPlaceholders(template[`bodyText${suffix}`], data);

  if (!subject && !html) return null;
  return { subject, html, text };
}

export async function renderSmsTemplate(key, lang, data) {
  const template = await getNotificationTemplate(key, 'sms');
  if (!template) return null;

  const suffix = lang === 'ar' ? 'Ar' : 'En';
  const body = applyPlaceholders(template[`smsBody${suffix}`], data);
  return body || null;
}

export async function seedNotificationTemplates() {
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    await NotificationTemplate.findOneAndUpdate(
      { key: template.key },
      template,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

export async function getSmsTemplateKeyForEvent(event) {
  const map = {
    order_created: 'order_sms_created',
    confirmed: 'order_sms_confirmed',
    preparing: 'order_sms_preparing',
    out_for_delivery: 'order_sms_out_for_delivery',
    delivered: 'order_sms_delivered',
    cancelled: 'order_sms_cancelled',
    refunded: 'order_sms_refunded',
    substitution: 'order_sms_substitution',
    tracking_live: 'order_sms_tracking_live',
    driver_assigned: 'order_sms_driver_assigned',
    driver_location: 'order_sms_driver_location',
    driver_nearby: 'order_sms_driver_nearby',
  };
  return map[event] || null;
}
