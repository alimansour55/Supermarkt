import { getTransporter } from '../config/nodemailer.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { welcomeTemplate, verificationTemplate, passwordResetTemplate } from './templates/authTemplates.js';
import {
  orderConfirmationTemplate,
  paymentSuccessTemplate,
  orderStatusUpdateTemplate,
  adminNewOrderTemplate,
} from './templates/orderTemplates.js';
import { lowStockTemplate } from './templates/inventoryTemplates.js';
import { STAFF_ROLES } from '../constants/roles.js';
import { renderEmailTemplate } from '../services/notificationTemplate.service.js';

export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(`Email not sent (SMTP disabled): ${subject} → ${to}`);
    return { simulated: true };
  }

  const recipients = Array.isArray(to) ? to.join(', ') : to;

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'MarketPlus <noreply@marketplus.com>',
    to: recipients,
    subject,
    html,
    text,
  });

  return info;
};

const dispatch = async (to, template) => sendEmail({ to, ...template });

async function dispatchTemplateOrFallback(to, key, lang, data, fallbackFn) {
  const custom = await renderEmailTemplate(key, lang, data);
  if (custom?.subject && custom?.html) {
    return dispatch(to, custom);
  }
  return dispatch(to, fallbackFn());
}

export const getAdminEmails = async () => {
  if (process.env.ADMIN_EMAIL) {
    return [process.env.ADMIN_EMAIL];
  }
  const staff = await User.find({ role: { $in: STAFF_ROLES } }).select('email');
  return staff.map((a) => a.email).filter(Boolean);
};

export const sendWelcomeEmail = (user) => dispatch(user.email, welcomeTemplate(user));

export const sendVerificationEmail = (user, token) => dispatch(user.email, verificationTemplate(user, token));

export const sendPasswordResetEmail = (user, token) => dispatch(user.email, passwordResetTemplate(user, token));

export const sendOrderConfirmationEmail = async (order, user) => {
  if (!user?.email) return null;
  return dispatchTemplateOrFallback(
    user.email,
    'order_confirmation',
    'ar',
    { order, user },
    () => orderConfirmationTemplate(order, user),
  );
};

export const sendPaymentSuccessEmail = async (order, user) => {
  if (!user?.email) return null;
  return dispatchTemplateOrFallback(
    user.email,
    'payment_success',
    'ar',
    { order, user },
    () => paymentSuccessTemplate(order, user),
  );
};

export const sendOrderStatusUpdateEmail = async (order, user, newStatus) => {
  if (!user?.email || !newStatus) return null;
  const { getStatusLabel } = await import('./helpers.js');
  return dispatchTemplateOrFallback(
    user.email,
    'order_status_update',
    'ar',
    { order, user, statusLabel: getStatusLabel(newStatus) },
    () => orderStatusUpdateTemplate(order, user, newStatus),
  );
};

export const sendAdminNewOrderEmail = async (order, customer) => {
  const adminEmails = await getAdminEmails();
  if (!adminEmails.length) {
    console.warn('No admin emails configured for new order notification');
    return null;
  }
  const custom = await renderEmailTemplate('admin_new_order', 'ar', { order, user: customer });
  const template = custom?.subject && custom?.html
    ? custom
    : adminNewOrderTemplate(order, customer);
  return sendEmail({ to: adminEmails, ...template });
};

export const loadOrderWithUser = async (orderId) => {
  const order = await Order.findById(orderId).populate('user', 'name email phone');
  if (!order) return null;
  return { order, user: order.user };
};

export const sendLowStockEmail = async (product, threshold) => {
  const adminEmails = await getAdminEmails();
  if (!adminEmails.length) {
    console.warn('No admin emails configured for low stock alert');
    return null;
  }
  const template = lowStockTemplate(product, threshold);
  return sendEmail({ to: adminEmails, ...template });
};

export const notifyOrderCreated = async (order, user) => {
  try {
    const { notifyNewOrder } = await import('../services/notification.service.js');
    const { notifyOrderTimeline } = await import('../services/orderNotification.service.js');
    await Promise.all([
      sendOrderConfirmationEmail(order, user),
      sendAdminNewOrderEmail(order, user),
      notifyNewOrder(order),
      notifyOrderTimeline(order, user, 'order_created'),
    ]);
  } catch (err) {
    console.error('Order email notification failed:', err.message);
  }
};

export const notifyPaymentSuccess = async (orderId) => {
  try {
    const data = await loadOrderWithUser(orderId);
    if (!data) return;
    const { order, user } = data;
    if (order.paymentStatus === 'paid') return;
    await sendPaymentSuccessEmail(order, user);
  } catch (err) {
    console.error('Payment success email failed:', err.message);
  }
};

export const notifyOrderStatusChange = async (orderId, newStatus, previousStatus) => {
  if (newStatus === previousStatus) return;
  try {
    const data = await loadOrderWithUser(orderId);
    if (!data) return;
    await sendOrderStatusUpdateEmail(data.order, data.user, newStatus);
  } catch (err) {
    console.error('Order status email failed:', err.message);
  }
};

// Prevent duplicate payment emails — call after save with paid status
export const notifyPaymentSuccessAfterPaid = async (orderId) => {
  try {
    const data = await loadOrderWithUser(orderId);
    if (!data || data.order.paymentStatus !== 'paid') return;
    await sendPaymentSuccessEmail(data.order, data.user);
  } catch (err) {
    console.error('Payment success email failed:', err.message);
  }
};
