import { formatPrice } from '../../utils/formatters';

export function printOrderInvoice(order, isAr) {
  const addr = order.shippingAddress;
  const addressLine = addr
    ? [addr.street, addr.building, addr.floor, addr.area, addr.governorate || addr.city]
        .filter(Boolean)
        .join(', ')
    : '';

  const rows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td>${isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:end">${formatPrice(item.price)}</td>
        <td style="text-align:end">${formatPrice(item.price * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${order.orderNumber}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: start; }
    th { background: #f8fafc; }
    .total { font-weight: 700; font-size: 1.1rem; margin-top: 16px; text-align: end; }
    .muted { color: #64748b; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${isAr ? 'فاتورة' : 'Invoice'} · ${order.orderNumber}</h1>
  <p class="muted">${new Date(order.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}</p>
  <p><strong>${isAr ? 'العميل' : 'Customer'}:</strong> ${order.user?.name || '—'} · ${order.phone}</p>
  <p><strong>${isAr ? 'العنوان' : 'Address'}:</strong> ${addressLine}</p>
  <table>
    <thead>
      <tr>
        <th>${isAr ? 'المنتج' : 'Item'}</th>
        <th>${isAr ? 'الكمية' : 'Qty'}</th>
        <th>${isAr ? 'السعر' : 'Price'}</th>
        <th>${isAr ? 'المجموع' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">${isAr ? 'الإجمالي' : 'Total'}: ${formatPrice(order.total)}</p>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
