import { renderEmailLayout } from '../layout.js';
import { clientUrl } from '../helpers.js';

export function lowStockTemplate(product, threshold) {
  const name = product.nameEn || product.nameAr || product.name || 'Product';
  const nameAr = product.nameAr || name;
  const adminUrl = clientUrl();

  const bodyHtml = `
    <p style="margin: 0 0 16px;"><strong>${nameAr}</strong> — مخزون منخفض</p>
    <p style="margin: 0 0 16px;">المخزون الحالي: <strong>${product.stock}</strong> (حد التنبيه: ${threshold})</p>
    <p style="margin: 0 0 8px;"><strong>${name}</strong> is running low.</p>
    <p style="margin: 0 0 24px;">Current stock: <strong>${product.stock}</strong> (threshold: ${threshold})</p>
    <p><a href="${adminUrl}/admin/products/${product._id}/edit" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">View product / عرض المنتج</a></p>
  `;

  const html = renderEmailLayout({
    title: `Low stock: ${name}`,
    heading: 'تنبيه مخزون منخفض · Low stock alert',
    bodyHtml,
    footerNote: 'MarketPlus inventory alert',
  });

  return {
    subject: `Low stock: ${name} (${product.stock} left)`,
    html,
    text: `${name} has low stock: ${product.stock} units (threshold ${threshold})`,
  };
}
