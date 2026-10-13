/**
 * Seller alerts beyond in-app notifications: emails and WhatsApp messages for new orders,
 * ship-by reminders and low stock. Each respects Seller.notificationPrefs, and nothing here
 * ever throws into the caller — an alert failing must not fail an order.
 */
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Shipment from '../models/Shipment.js';
import { sendEmail } from '../utils/sendEmail.js';
import { isWhatsAppConfigured, sendWhatsAppText } from './whatsapp.service.js';
import { notifySellerUsers } from './marketplace.service.js';
import { sellerNewOrderTemplate, sellerLowStockTemplate } from '../emails/templates/sellerTemplates.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;
export const DEFAULT_LOW_STOCK = 5;
/** Remind the seller this long before the ship-by time. */
const REMINDER_LEAD_MS = 6 * HOUR;

const prefs = (seller) => ({
  emailOrders: seller?.notificationPrefs?.emailOrders !== false,
  whatsappOrders: seller?.notificationPrefs?.whatsappOrders === true,
  emailLowStock: seller?.notificationPrefs?.emailLowStock !== false,
  shipByReminders: seller?.notificationPrefs?.shipByReminders !== false,
});

/** Owner + active staff emails (deduped), falling back to the store's contact email. */
async function teamEmails(seller) {
  const users = await User.find({ seller: seller._id, isActive: { $ne: false } }).select('email').lean();
  return [...new Set([seller.email, ...users.map((u) => u.email)].filter(Boolean))];
}

async function whatsapp(seller, text) {
  if (!isWhatsAppConfigured() || !seller.phone) return;
  try {
    await sendWhatsAppText(seller.phone, text);
  } catch (err) {
    console.error('Seller WhatsApp failed:', err.message);
  }
}

export const shipByDate = (shipment, seller) => new Date(new Date(shipment.createdAt).getTime() + ((seller?.handlingDays ?? 2) + 1) * DAY);

/** New seller-shipped order: email (+ WhatsApp when the seller opted in). */
export async function sendNewOrderAlerts(shipment) {
  try {
    const seller = await Seller.findById(shipment.seller).lean();
    if (!seller) return;
    const p = prefs(seller);
    const shipBy = shipment.fulfilledBy === 'seller' ? shipByDate(shipment, seller) : null;
    if (p.emailOrders) {
      const to = await teamEmails(seller);
      if (to.length) await sendEmail({ to, ...sellerNewOrderTemplate({ seller, shipment, shipBy }) });
    }
    if (p.whatsappOrders && shipment.fulfilledBy === 'seller') {
      const units = (shipment.items || []).reduce((n, i) => n + (i.quantity || 0), 0);
      await whatsapp(seller, `طلب جديد ${shipment.shipmentNumber}: ${units} قطعة. أكّده من مركز البائعين.`);
    }
  } catch (err) {
    console.error('New-order alert failed:', err.message);
  }
}

/** Seller-shipped orders due within REMINDER_LEAD_MS and not shipped yet — one reminder each. */
export async function runShipByReminders(now = new Date()) {
  const open = await Shipment.find({
    fulfilledBy: 'seller',
    status: { $in: ['pending', 'confirmed', 'packed'] },
    shipByReminderAt: null,
    createdAt: { $gte: new Date(now.getTime() - 40 * DAY) },
  }).select('seller shipmentNumber createdAt status').lean();
  if (!open.length) return 0;

  const sellers = new Map((await Seller.find({ _id: { $in: [...new Set(open.map((s) => String(s.seller)))] } }).lean()).map((s) => [String(s._id), s]));
  let sent = 0;
  for (const shipment of open) {
    const seller = sellers.get(String(shipment.seller));
    if (!seller) continue;
    const due = shipByDate(shipment, seller);
    if (due.getTime() - now.getTime() > REMINDER_LEAD_MS) continue;
    // Claim it first so two job runs never double-send.
    // eslint-disable-next-line no-await-in-loop
    const claimed = await Shipment.updateOne({ _id: shipment._id, shipByReminderAt: null }, { $set: { shipByReminderAt: now } });
    if (!claimed.modifiedCount || !prefs(seller).shipByReminders) continue;
    const late = due <= now;
    // eslint-disable-next-line no-await-in-loop
    await notifySellerUsers(seller._id, {
      type: 'seller_new_order',
      titleAr: late ? 'طلب متأخر عن موعد الشحن' : 'اشحن خلال ساعات',
      titleEn: late ? 'Order past its ship-by time' : 'Ship within hours',
      messageAr: `${shipment.shipmentNumber} — ${late ? 'اشحنه الآن لتجنب التأثير على صحة حسابك.' : 'موعد الشحن يقترب.'}`,
      messageEn: `${shipment.shipmentNumber} — ${late ? 'ship it now to protect your account health.' : 'the ship-by time is close.'}`,
      link: `/seller-center/orders/${shipment._id}`,
    });
    if (prefs(seller).whatsappOrders) {
      // eslint-disable-next-line no-await-in-loop
      await whatsapp(seller, `تذكير: الطلب ${shipment.shipmentNumber} ${late ? 'متأخر عن موعد الشحن' : 'يجب شحنه خلال ساعات'}.`);
    }
    sent += 1;
  }
  return sent;
}

/**
 * Live seller products whose available stock fell to their threshold get one alert; products
 * back above it are re-armed. Products with variants alert on their total.
 */
export async function runLowStockCheck(now = new Date()) {
  const products = await Product.find({ seller: { $ne: null }, listingStatus: 'approved' })
    .select('seller nameAr nameEn stock reservedStock variants lowStockThreshold lowStockAlertedAt')
    .lean();
  const available = (p) => (p.variants?.length
    ? p.variants.reduce((n, v) => n + Math.max(0, (v.stock || 0) - (v.reservedStock || 0)), 0)
    : Math.max(0, (p.stock || 0) - (p.reservedStock || 0)));

  const toAlert = [];
  const rearm = [];
  for (const p of products) {
    const threshold = p.lowStockThreshold ?? DEFAULT_LOW_STOCK;
    const left = available(p);
    if (left <= threshold && !p.lowStockAlertedAt) toAlert.push({ p, left });
    else if (left > threshold && p.lowStockAlertedAt) rearm.push(p._id);
  }
  if (rearm.length) await Product.updateMany({ _id: { $in: rearm } }, { $set: { lowStockAlertedAt: null } });
  if (!toAlert.length) return 0;

  const sellers = new Map((await Seller.find({ _id: { $in: [...new Set(toAlert.map(({ p }) => String(p.seller)))] } }).lean()).map((s) => [String(s._id), s]));
  let sent = 0;
  for (const { p, left } of toAlert) {
    // eslint-disable-next-line no-await-in-loop
    const claimed = await Product.updateOne({ _id: p._id, lowStockAlertedAt: null }, { $set: { lowStockAlertedAt: now } });
    const seller = sellers.get(String(p.seller));
    if (!claimed.modifiedCount || !seller) continue;
    // eslint-disable-next-line no-await-in-loop
    await notifySellerUsers(seller._id, {
      type: 'seller_low_stock',
      titleAr: left <= 0 ? 'نفد المخزون' : 'مخزون منخفض',
      titleEn: left <= 0 ? 'Out of stock' : 'Low stock',
      messageAr: `«${p.nameAr}»: ${left} قطعة متبقية.`,
      messageEn: `"${p.nameEn}": ${left} left.`,
      link: `/seller-center/inventory?stock=${left <= 0 ? 'out' : 'low'}`,
    });
    if (prefs(seller).emailLowStock) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const to = await teamEmails(seller);
        // eslint-disable-next-line no-await-in-loop
        if (to.length) await sendEmail({ to, ...sellerLowStockTemplate({ seller, product: p, available: left }) });
      } catch (err) {
        console.error('Low-stock email failed:', err.message);
      }
    }
    sent += 1;
  }
  return sent;
}
