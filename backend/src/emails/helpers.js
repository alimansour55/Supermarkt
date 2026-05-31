const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

export const formatEmailPrice = (amount) => `${Number(amount || 0).toFixed(2)} ج.م`;

export const formatEmailDate = (date) => new Intl.DateTimeFormat('ar-EG', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(date));

export const ORDER_STATUS_LABELS = {
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  preparing: { ar: 'جاري التجهيز', en: 'Preparing' },
  out_for_delivery: { ar: 'في الطريق إليك', en: 'Out for delivery' },
  delivered: { ar: 'تم التسليم', en: 'Delivered' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
};

export const getStatusLabel = (status) => ORDER_STATUS_LABELS[status]?.ar || status;

export const renderButton = (href, label) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 28px auto;">
    <tr>
      <td style="border-radius: 12px; background: linear-gradient(135deg, #059669 0%, #047857 100%);">
        <a href="${href}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

export const renderInfoBox = (content) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
    <tr>
      <td style="padding: 16px 20px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #065f46; text-align: right;">
        ${content}
      </td>
    </tr>
  </table>
`;

export const renderKeyValueTable = (rows) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0; border-collapse: collapse;">
    ${rows.map(([label, value]) => `
      <tr>
        <td style="padding: 10px 0; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; color: #64748b; text-align: right; width: 40%; border-bottom: 1px solid #e2e8f0;">${label}</td>
        <td style="padding: 10px 0; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #0f172a; text-align: left; border-bottom: 1px solid #e2e8f0;">${value}</td>
      </tr>
    `).join('')}
  </table>
`;

export const renderOrderItems = (items = []) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <tr style="background-color: #f8fafc;">
      <th style="padding: 12px 16px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 13px; color: #64748b; text-align: right;">المنتج</th>
      <th style="padding: 12px 16px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 13px; color: #64748b; text-align: center;">الكمية</th>
      <th style="padding: 12px 16px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 13px; color: #64748b; text-align: left;">السعر</th>
    </tr>
    ${items.map((item) => `
      <tr>
        <td style="padding: 12px 16px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; color: #0f172a; text-align: right; border-top: 1px solid #e2e8f0;">
          ${item.nameAr || item.nameEn || item.name}
        </td>
        <td style="padding: 12px 16px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; color: #0f172a; text-align: center; border-top: 1px solid #e2e8f0;">×${item.quantity}</td>
        <td style="padding: 12px 16px; font-family: 'Cairo', Tahoma, Arial, sans-serif; font-size: 14px; color: #0f172a; text-align: left; border-top: 1px solid #e2e8f0;">${formatEmailPrice(item.price * item.quantity)}</td>
      </tr>
    `).join('')}
  </table>
`;

export { clientUrl };
