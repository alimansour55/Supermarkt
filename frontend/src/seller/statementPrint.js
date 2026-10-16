/**
 * Monthly seller statement + marketplace fee invoice as printable HTML (opened in a new window
 * and printed / saved as PDF by the browser). Pure string builders — tested in
 * frontend/test/statementPrint.test.js.
 */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

export const LEDGER_LABELS = {
  sale: ['مبيعات', 'Sales'],
  delivery_fee: ['رسوم توصيل', 'Delivery fees'],
  commission: ['عمولة', 'Commission'],
  commission_reversal: ['استرداد عمولة (مرتجع)', 'Commission refunded (returns)'],
  fixed_fee: ['رسوم ثابتة', 'Fixed fees'],
  fulfillment_fee: ['رسوم الشحن من مخزننا', 'Fulfillment fees'],
  payment_fee: ['رسوم الدفع', 'Payment fees'],
  subscription_fee: ['اشتراك شهري', 'Monthly plan fee'],
  fee_vat: ['ضريبة على الرسوم', 'VAT on fees'],
  penalty: ['غرامات', 'Penalties'],
  cod_collected: ['نقدية حصّلها البائع', 'Cash you collected'],
  return: ['مرتجعات', 'Returns'],
  adjustment: ['تسويات', 'Adjustments'],
  payout: ['تحويلات', 'Payouts'],
  opening_balance: ['الرصيد الافتتاحي', 'Opening balance'],
  closing_balance: ['الرصيد الختامي', 'Closing balance'],
};
export const ledgerLabel = (type, isAr) => (LEDGER_LABELS[type] || [type, type])[isAr ? 0 : 1];

/** The last `count` Cairo months as { value: 'YYYY-MM', label }, newest first. */
export function monthOptions(now = new Date(), count = 12, isAr = false) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(now).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 15));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { value, label: d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  });
}

function shell(title, body, isAr) {
  return `<!doctype html><html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;color:#0f172a;margin:32px;font-size:13px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:24px 0 8px}
.muted{color:#64748b}.row{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:start}
th{background:#f8fafc;font-weight:600}td.n,th.n{text-align:end;font-variant-numeric:tabular-nums;direction:ltr}
.total td{font-weight:700;border-top:2px solid #0f172a}.box{border:1px solid #e2e8f0;border-radius:10px;padding:12px;min-width:220px}
@media print{body{margin:12mm}button{display:none}}
</style></head><body>${body}<p class="muted" style="margin-top:32px">${isAr ? 'مستند إلكتروني لا يحتاج إلى توقيع.' : 'Electronic document — no signature required.'}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
}

function parties(s, isAr) {
  const issuerName = isAr ? s.issuer.nameAr || s.issuer.nameEn : s.issuer.nameEn || s.issuer.nameAr;
  const sellerName = s.seller.legalName || (isAr ? s.seller.nameAr : s.seller.nameEn);
  const addr = [s.seller.address?.street, s.seller.address?.city, s.seller.address?.governorate].filter(Boolean).join(isAr ? '، ' : ', ');
  return `<div class="row">
<div class="box"><div class="muted">${isAr ? 'من' : 'From'}</div><strong>${esc(issuerName)}</strong><div>${esc(isAr ? s.issuer.addressAr : s.issuer.addressEn)}</div>${s.issuer.taxId ? `<div>${isAr ? 'الرقم الضريبي' : 'Tax ID'}: ${esc(s.issuer.taxId)}</div>` : ''}</div>
<div class="box"><div class="muted">${isAr ? 'إلى' : 'To'}</div><strong>${esc(sellerName)}</strong>${addr ? `<div>${esc(addr)}</div>` : ''}${s.seller.taxId ? `<div>${isAr ? 'الرقم الضريبي' : 'Tax ID'}: ${esc(s.seller.taxId)}</div>` : ''}${s.seller.commercialRegisterNo ? `<div>${isAr ? 'السجل التجاري' : 'Commercial register'}: ${esc(s.seller.commercialRegisterNo)}</div>` : ''}</div>
</div>`;
}

const monthTitle = (month, isAr) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/** Tax invoice for the marketplace's fees in one month. */
export function feeInvoiceHtml(s, isAr = false) {
  const t = s.totals;
  const lines = t.invoiceLines.map((l) => `<tr><td>${esc(ledgerLabel(l.type, isAr))}</td><td class="n">${money(l.amount)}</td></tr>`).join('');
  const body = `<div class="row"><div><h1>${isAr ? 'فاتورة ضريبية — رسوم السوق' : 'Tax invoice — marketplace fees'}</h1>
<div class="muted">${esc(s.invoiceNumber)} · ${esc(monthTitle(s.month, isAr))}</div></div></div>
<div style="margin-top:16px">${parties(s, isAr)}</div>
<table><thead><tr><th>${isAr ? 'البند' : 'Item'}</th><th class="n">${isAr ? 'المبلغ' : 'Amount'}</th></tr></thead><tbody>
${lines || `<tr><td colspan="2" class="muted">${isAr ? 'لا توجد رسوم هذا الشهر.' : 'No fees this month.'}</td></tr>`}
<tr><td>${isAr ? 'الإجمالي قبل الضريبة' : 'Subtotal'}</td><td class="n">${money(t.fees)}</td></tr>
<tr><td>${ledgerLabel('fee_vat', isAr)}</td><td class="n">${money(t.vat)}</td></tr>
<tr class="total"><td>${isAr ? 'الإجمالي' : 'Total'}</td><td class="n">${money(t.feesWithVat)}</td></tr>
</tbody></table>
<p class="muted">${isAr ? 'خُصمت هذه الرسوم من مستحقاتك ولا يلزم سدادها.' : 'These fees were deducted from your earnings — nothing to pay.'}</p>`;
  return shell(`${s.invoiceNumber}`, body, isAr);
}

/** Every ledger line in the month with opening / closing balances and totals by type. */
export function statementHtml(s, isAr = false) {
  const day = (d) => new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short' }).format(new Date(d));
  const rows = s.entries.map((e) => `<tr><td>${esc(day(e.date))}</td><td>${esc(ledgerLabel(e.type, isAr))}</td><td>${esc(e.reference)}</td><td>${esc(e.note)}</td><td class="n">${money(e.amount)}</td></tr>`).join('');
  const byType = Object.entries(s.totals.byType).map(([k, v]) => `<tr><td>${esc(ledgerLabel(k, isAr))}</td><td class="n">${money(v)}</td></tr>`).join('');
  const body = `<h1>${isAr ? 'كشف حساب شهري' : 'Monthly statement'}</h1>
<div class="muted">${esc(isAr ? s.seller.nameAr : s.seller.nameEn)} · ${esc(monthTitle(s.month, isAr))}</div>
<div style="margin-top:16px">${parties(s, isAr)}</div>
<h2>${isAr ? 'الملخص' : 'Summary'}</h2>
<table><tbody><tr><td>${ledgerLabel('opening_balance', isAr)}</td><td class="n">${money(s.openingBalance)}</td></tr>${byType}
<tr class="total"><td>${ledgerLabel('closing_balance', isAr)}</td><td class="n">${money(s.closingBalance)}</td></tr></tbody></table>
<h2>${isAr ? 'الحركات' : 'Transactions'}</h2>
<table><thead><tr><th>${isAr ? 'التاريخ' : 'Date'}</th><th>${isAr ? 'النوع' : 'Type'}</th><th>${isAr ? 'المرجع' : 'Reference'}</th><th>${isAr ? 'ملاحظة' : 'Note'}</th><th class="n">${isAr ? 'المبلغ' : 'Amount'}</th></tr></thead>
<tbody>${rows || `<tr><td colspan="5" class="muted">${isAr ? 'لا توجد حركات.' : 'No transactions.'}</td></tr>`}</tbody></table>`;
  return shell(`${isAr ? 'كشف حساب' : 'Statement'} ${s.month}`, body, isAr);
}

/** Open printable HTML in a new tab (the page prints itself). Returns false if a popup blocker stopped it. */
export function openPrintable(html) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
