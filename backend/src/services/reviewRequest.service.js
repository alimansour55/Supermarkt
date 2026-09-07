import StoreSettings from '../models/StoreSettings.js';
import { sendEmail } from '../emails/index.js';
import { twilioClient, isSmsConfigured, getTwilioPhoneNumber } from '../config/sms.js';

const REVIEW_SMS = {
  ar: (order) => `سوق+: تم تسليم طلبك ${order.orderNumber}. شاركنا رأيك في المنتجات من صفحة طلباتي ⭐`,
  en: (order) => `MarketPlus: Order ${order.orderNumber} delivered. Rate your items in My Orders ⭐`,
};

const REVIEW_EMAIL = {
  ar: {
    subject: (order) => `قيّم طلبك ${order.orderNumber} — سوق+`,
    text: (order, user) => `مرحباً ${user?.name || ''},\n\nتم تسليم طلبك ${order.orderNumber}. نود معرفة رأيك في المنتجات.\n\nافتح «طلباتي» في التطبيق وقيّم مشترياتك.`,
  },
  en: {
    subject: (order) => `Rate order ${order.orderNumber} — MarketPlus`,
    text: (order, user) => `Hi ${user?.name || ''},\n\nYour order ${order.orderNumber} was delivered. We'd love your feedback.\n\nOpen My Orders in the app to rate your items.`,
  },
};

async function sendReviewSms(phone, order, lang) {
  if (!phone) return { skipped: true };
  const body = (REVIEW_SMS[lang] || REVIEW_SMS.ar)(order);

  if (!isSmsConfigured()) {
    if (process.env.NODE_ENV !== 'production' || process.env.SMS_DEV_MODE === 'true') {
      console.log(`\n📱 REVIEW REQUEST SMS → ${phone}\n   ${body}\n`);
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

export async function sendReviewRequest(order, user, lang = 'ar', { force = false } = {}) {
  if (!order || order.orderStatus !== 'delivered') {
    return { skipped: true, reason: 'not_delivered' };
  }

  if (order.reviewRequestSentAt && !force) {
    return { skipped: true, reason: 'already_sent' };
  }

  const settings = await StoreSettings.findOne().lean();
  const reviewSettings = settings?.reviewSettings || {};
  if (!force && reviewSettings.autoRequestOnDelivered === false) {
    return { skipped: true, reason: 'disabled' };
  }

  const results = {};

  const phone = order.phone || user?.phone;
  if (reviewSettings.requestSms !== false) {
    results.sms = await sendReviewSms(phone, order, lang);
  }

  if (reviewSettings.requestEmail !== false && user?.email) {
    try {
      const tpl = REVIEW_EMAIL[lang] || REVIEW_EMAIL.ar;
      await sendEmail({
        to: user.email,
        subject: tpl.subject(order),
        text: tpl.text(order, user),
      });
      results.email = { sent: true };
    } catch (err) {
      results.email = { error: err.message };
    }
  }

  order.reviewRequestSentAt = new Date();
  await order.save();

  return { sent: true, ...results };
}
