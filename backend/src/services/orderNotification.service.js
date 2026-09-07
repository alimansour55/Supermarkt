import { twilioClient, isSmsConfigured, getTwilioPhoneNumber } from '../config/sms.js';
import { ORDER_STATUSES } from '../constants/orderStatuses.js';
import { getSmsTemplateKeyForEvent, renderSmsTemplate } from '../services/notificationTemplate.service.js';

function statusLabel(status, lang = 'ar') {
  const row = ORDER_STATUSES.find((s) => s.value === status);
  return row ? (lang === 'ar' ? row.labelAr : row.labelEn) : status;
}

const SMS_TEMPLATES = {
  ar: {
    order_created: (o) => `سوق+: تم استلام طلبك ${o.orderNumber}. الإجمالي ${o.total} ج.م. شكراً لك!`,
    confirmed: (o) => `سوق+: تم تأكيد طلبك ${o.orderNumber} وجاري تجهيزه.`,
    preparing: (o) => `سوق+: طلبك ${o.orderNumber} قيد التجهيز الآن.`,
    out_for_delivery: (o) => `سوق+: طلبك ${o.orderNumber} في الطريق إليك!`,
    delivered: (o) => `سوق+: تم تسليم طلبك ${o.orderNumber}. نتمنى لك تسوقاً سعيداً!`,
    delivery_failed: (o) => {
      const reason = o.deliveryFailureReasonAr || o.deliveryFailureReasonEn || '';
      return `سوق+: تعذّر تسليم طلبك ${o.orderNumber}.${reason ? ` السبب: ${reason}` : ' سنتواصل معك قريباً.'}`;
    },
    cancelled: (o) => `سوق+: تم إلغاء طلبك ${o.orderNumber}.${o.cancellationReason ? ` السبب: ${o.cancellationReason}` : ''}`,
    refunded: (o) => `سوق+: تم استرداد ${o.refundAmount} ج.م للطلب ${o.orderNumber}.`,
    substitution: (o) => `سوق+: يوجد اقتراح بديل لطلبك ${o.orderNumber}. راجع التطبيق للموافقة.`,
    tracking_live: (o) => `سوق+: تتبع طلبك ${o.orderNumber} مباشرة على الخريطة: ${o.trackUrl || ''}`,
    driver_assigned: (o) => `سوق+: تم تعيين مندوب لطلبك ${o.orderNumber}. تتبع التوصيل: ${o.trackUrl || ''}`,
    driver_location: (o) => {
      const eta = o.etaText ? ` (${o.etaText})` : '';
      return `سوق+: المندوب في الطريق لطلبك ${o.orderNumber}${eta}. تتبع: ${o.trackUrl || ''}`;
    },
    driver_nearby: (o) => {
      const eta = o.etaText ? ` (${o.etaText})` : '';
      return `سوق+: مندوب طلبك ${o.orderNumber} على وشك الوصول${eta}!`;
    },
  },
  en: {
    order_created: (o) => `MarketPlus: Order ${o.orderNumber} received. Total ${o.total} EGP. Thank you!`,
    confirmed: (o) => `MarketPlus: Order ${o.orderNumber} confirmed and being prepared.`,
    preparing: (o) => `MarketPlus: Order ${o.orderNumber} is being prepared.`,
    out_for_delivery: (o) => `MarketPlus: Order ${o.orderNumber} is out for delivery!`,
    delivered: (o) => `MarketPlus: Order ${o.orderNumber} delivered. Enjoy!`,
    delivery_failed: (o) => {
      const reason = o.deliveryFailureReasonEn || o.deliveryFailureReasonAr || '';
      return `MarketPlus: Delivery failed for order ${o.orderNumber}.${reason ? ` Reason: ${reason}` : ' We will contact you.'}`;
    },
    cancelled: (o) => `MarketPlus: Order ${o.orderNumber} cancelled.${o.cancellationReason ? ` Reason: ${o.cancellationReason}` : ''}`,
    refunded: (o) => `MarketPlus: Refund of ${o.refundAmount} EGP processed for order ${o.orderNumber}.`,
    substitution: (o) => `MarketPlus: A substitution was suggested for order ${o.orderNumber}. Please review in the app.`,
    tracking_live: (o) => `MarketPlus: Track order ${o.orderNumber} live: ${o.trackUrl || ''}`,
    driver_assigned: (o) => `MarketPlus: A driver is assigned to order ${o.orderNumber}. Track: ${o.trackUrl || ''}`,
    driver_location: (o) => {
      const eta = o.etaText ? ` (${o.etaText})` : '';
      return `MarketPlus: Driver en route for order ${o.orderNumber}${eta}. Track: ${o.trackUrl || ''}`;
    },
    driver_nearby: (o) => {
      const eta = o.etaText ? ` (${o.etaText})` : '';
      return `MarketPlus: Your driver for order ${o.orderNumber} is almost there${eta}!`;
    },
  },
};

export async function sendOrderSms(phone, templateKey, order, lang = 'ar') {
  if (!phone) return { skipped: true };

  const dbKey = (await getSmsTemplateKeyForEvent(templateKey)) || templateKey;
  const templateData = { order };
  if (order?.trackUrl) templateData.trackUrl = order.trackUrl;
  if (order?.etaText) templateData.etaText = order.etaText;
  if (order?.driverName) templateData.driverName = order.driverName;

  let body = await renderSmsTemplate(dbKey, lang, templateData);
  if (!body) {
    const templates = SMS_TEMPLATES[lang] || SMS_TEMPLATES.ar;
    const builder = templates[templateKey];
    if (!builder) return { skipped: true };
    body = builder(order);
  }

  if (templateKey === 'out_for_delivery' && process.env.CLIENT_URL && order?._id) {
    const trackUrl = `${process.env.CLIENT_URL.replace(/\/$/, '')}/orders/${order._id}?track=1`;
    body = lang === 'ar' ? `${body} تتبع: ${trackUrl}` : `${body} Track: ${trackUrl}`;
  }

  if (!isSmsConfigured()) {
    if (process.env.NODE_ENV !== 'production' || process.env.SMS_DEV_MODE === 'true') {
      console.log(`\n📱 ORDER SMS → ${phone}\n   ${body}\n`);
      return { simulated: true };
    }
    return { skipped: true };
  }

  await twilioClient.messages.create({
    body,
    from: getTwilioPhoneNumber(),
    to: phone,
  });

  return { sent: true };
}

export async function notifyOrderTimeline(order, user, event, lang = 'ar') {
  const phone = order.phone || user?.phone;
  const statusEvents = new Set([
    'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'delivery_failed', 'cancelled',
  ]);

  if (statusEvents.has(event)) {
    await sendOrderSms(phone, event, order, lang);
  } else if (event === 'order_created') {
    await sendOrderSms(phone, 'order_created', order, lang);
  } else if (event === 'refunded') {
    await sendOrderSms(phone, 'refunded', order, lang);
  } else if (event === 'substitution') {
    await sendOrderSms(phone, 'substitution', order, lang);
  }
}

export { statusLabel };
