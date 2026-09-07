import { renderEmailLayout } from '../layout.js';
import {
  renderButton,
  renderInfoBox,
  renderKeyValueTable,
  renderOrderItems,
  formatEmailPrice,
  formatEmailDate,
  getStatusLabel,
  clientUrl,
} from '../helpers.js';

const orderSummaryBlock = (order) => `
  ${renderOrderItems(order.items)}
  ${renderKeyValueTable([
    ['المجموع الفرعي', formatEmailPrice(order.subtotal)],
    ['رسوم التوصيل', formatEmailPrice(order.deliveryFee)],
    ...(order.discount > 0 ? [['الخصم', `- ${formatEmailPrice(order.discount)}`]] : []),
    ['<strong style="color:#059669">الإجمالي</strong>', `<strong style="color:#059669;font-size:16px">${formatEmailPrice(order.total)}</strong>`],
  ])}
`;

export const orderConfirmationTemplate = (order, user) => {
  const ordersUrl = `${clientUrl()}/orders`;
  const paymentLabel = order.paymentMethod === 'stripe' ? 'بطاقة ائتمان' : 'الدفع عند الاستلام';

  const bodyHtml = `
    <p style="margin: 0 0 16px;">مرحباً <strong>${user.name}</strong>،</p>
    <p style="margin: 0 0 16px;">
      تم استلام طلبك بنجاح! نحن نجهّزه الآن وسنُبلغك بكل تحديث.
    </p>
    ${renderInfoBox(`
      <strong>رقم الطلب:</strong> ${order.orderNumber}<br/>
      <strong>التاريخ:</strong> ${formatEmailDate(order.createdAt || new Date())}<br/>
      <strong>طريقة الدفع:</strong> ${paymentLabel}<br/>
      <strong>طريقة التوصيل:</strong> ${
        order.deliveryMethod === 'express'
          ? 'توصيل سريع'
          : order.deliveryMethod === 'recurring'
            ? `توصيل دوري (${order.recurringDelivery?.frequency === 'monthly' ? 'شهري' : order.recurringDelivery?.frequency === 'biweekly' ? 'كل أسبوعين' : 'أسبوعي'})`
            : 'توصيل عادي'
      }
    `)}
    ${orderSummaryBlock(order)}
    ${renderKeyValueTable([
      ['عنوان التوصيل', `${order.shippingAddress?.street || ''}${order.shippingAddress?.city ? `، ${order.shippingAddress.city}` : ''}`],
      ['الهاتف', order.phone || '—'],
    ])}
    ${renderButton(ordersUrl, '📦 متابعة الطلب')}
  `;

  return {
    subject: `تأكيد الطلب ${order.orderNumber} — سوق+ MarketPlus`,
    html: renderEmailLayout({
      preheader: `تم تأكيد طلبك ${order.orderNumber} بقيمة ${formatEmailPrice(order.total)}`,
      title: 'تأكيد الطلب',
      heading: 'تم استلام طلبك! ✅',
      subtitle: `رقم الطلب: ${order.orderNumber}`,
      bodyHtml,
    }),
    text: `Order ${order.orderNumber} confirmed. Total: ${formatEmailPrice(order.total)}. Track: ${ordersUrl}`,
  };
};

export const paymentSuccessTemplate = (order, user) => {
  const ordersUrl = `${clientUrl()}/orders`;

  const bodyHtml = `
    <p style="margin: 0 0 16px;">مرحباً <strong>${user.name}</strong>،</p>
    <p style="margin: 0 0 16px;">
      تم استلام دفعتك بنجاح. شكراً لثقتك في سوق+!
    </p>
    ${renderInfoBox(`
      ✅ <strong>تم الدفع بنجاح</strong><br/>
      رقم الطلب: <strong>${order.orderNumber}</strong><br/>
      المبلغ المدفوع: <strong>${formatEmailPrice(order.total)}</strong>
    `)}
    ${orderSummaryBlock(order)}
    ${renderButton(ordersUrl, '📋 عرض تفاصيل الطلب')}
  `;

  return {
    subject: `تم الدفع بنجاح — ${order.orderNumber} — سوق+`,
    html: renderEmailLayout({
      preheader: `تم دفع ${formatEmailPrice(order.total)} للطلب ${order.orderNumber}`,
      title: 'تم الدفع',
      heading: 'تم الدفع بنجاح! 💳',
      subtitle: 'شكراً لك — طلبك قيد المعالجة',
      bodyHtml,
    }),
    text: `Payment received for order ${order.orderNumber}: ${formatEmailPrice(order.total)}`,
  };
};

export const orderStatusUpdateTemplate = (order, user, newStatus) => {
  const statusLabel = getStatusLabel(newStatus);
  const ordersUrl = `${clientUrl()}/orders`;

  const statusMessages = {
    confirmed: 'تم تأكيد طلبك وسيتم تجهيزه قريباً.',
    preparing: 'فريقنا يجهّز طلبك الآن.',
    out_for_delivery: 'طلبك في الطريق إليك! استعد للاستلام.',
    delivered: 'تم تسليم طلبك. نتمنى أن تستمتع بمشترياتك!',
    delivery_failed: 'تعذّر تسليم طلبك. راجع التفاصيل أدناه أو تواصل معنا.',
    cancelled: 'تم إلغاء طلبك. إذا كان لديك أي استفسار، تواصل معنا.',
    refunded: 'تم استرداد المبلغ إلى حسابك. قد يستغرق ظهوره بضعة أيام.',
    substitution_pending: 'اقترحنا منتجاً بديلاً لأحد عناصر طلبك. راجع التطبيق للموافقة أو الرفض.',
    message: 'لديك رسالة جديدة بخصوص طلبك. راجع التطبيق للرد.',
    pending: 'طلبك قيد المراجعة.',
  };

  const failureReason = newStatus === 'delivery_failed'
    ? (order.deliveryFailureReasonAr || order.deliveryFailureReasonEn || '')
    : '';

  const bodyHtml = `
    <p style="margin: 0 0 16px;">مرحباً <strong>${user.name}</strong>،</p>
    <p style="margin: 0 0 16px;">${statusMessages[newStatus] || 'تم تحديث حالة طلبك.'}</p>
    ${renderInfoBox(`
      <strong>رقم الطلب:</strong> ${order.orderNumber}<br/>
      <strong>الحالة الجديدة:</strong> <span style="color:#059669;font-weight:700">${statusLabel}</span>
      ${failureReason ? `<br/><strong>سبب فشل التسليم:</strong> ${failureReason}` : ''}
    `)}
    ${renderButton(ordersUrl, '🔍 متابعة الطلب')}
  `;

  return {
    subject: `تحديث الطلب ${order.orderNumber}: ${statusLabel} — سوق+`,
    html: renderEmailLayout({
      preheader: `حالة طلبك ${order.orderNumber}: ${statusLabel}`,
      title: 'تحديث الطلب',
      heading: `تحديث حالة الطلب`,
      subtitle: statusLabel,
      bodyHtml,
    }),
    text: `Order ${order.orderNumber} status: ${statusLabel}`,
  };
};

export const adminNewOrderTemplate = (order, customer) => {
  const adminUrl = `${clientUrl()}/admin/orders`;

  const bodyHtml = `
    <p style="margin: 0 0 16px;">📬 <strong>طلب جديد على سوق+</strong></p>
    ${renderInfoBox(`
      <strong>رقم الطلب:</strong> ${order.orderNumber}<br/>
      <strong>العميل:</strong> ${customer.name} (${customer.email})<br/>
      <strong>الهاتف:</strong> ${order.phone || customer.phone || '—'}<br/>
      <strong>الإجمالي:</strong> ${formatEmailPrice(order.total)}<br/>
      <strong>الدفع:</strong> ${order.paymentMethod === 'stripe' ? 'Stripe' : 'COD'}
    `)}
    ${renderOrderItems(order.items)}
    ${renderButton(adminUrl, '⚙️ إدارة الطلب')}
  `;

  return {
    subject: `[سوق+] طلب جديد ${order.orderNumber} — ${formatEmailPrice(order.total)}`,
    html: renderEmailLayout({
      preheader: `طلب جديد ${order.orderNumber} من ${customer.name}`,
      title: 'طلب جديد',
      heading: '🔔 طلب جديد!',
      subtitle: order.orderNumber,
      bodyHtml,
      footerNote: 'إشعار للإدارة — MarketPlus Admin',
    }),
    text: `New order ${order.orderNumber} from ${customer.email}. Total: ${formatEmailPrice(order.total)}`,
  };
};
