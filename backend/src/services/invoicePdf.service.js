import { createRequire } from 'module';
import PDFDocument from 'pdfkit';
import { ORDER_STATUSES } from '../constants/orderStatuses.js';
import {
  DEFAULT_INVOICE,
  SAMPLE_INVOICE_ORDER,
  SAMPLE_INVOICE_USER,
} from '../constants/invoiceDefaults.js';
import {
  formatPdfDate,
  segmentRuns,
  getPdfFontBuffer,
  getPdfBoldFontBuffer,
} from '../utils/arabicPdfText.js';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode');

export { SAMPLE_INVOICE_ORDER, SAMPLE_INVOICE_USER };

/* ================================================================== *
 * Settings
 * ================================================================== */

function plainSettings(storeSettings) {
  if (!storeSettings) return {};
  if (typeof storeSettings.toObject === 'function') return storeSettings.toObject();
  return storeSettings;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const normalizeHex = (value, fallback) => {
  const v = String(value || '').trim();
  return HEX_RE.test(v) ? v.toLowerCase() : fallback;
};

function mergeInvoiceSettings(storeSettings = {}) {
  const plain = plainSettings(storeSettings);
  const invoice = plain.invoice || {};
  const merged = {
    ...DEFAULT_INVOICE,
    ...invoice,
    labels: { ...DEFAULT_INVOICE.labels, ...(invoice.labels || {}) },
    columns: { ...DEFAULT_INVOICE.columns, ...(invoice.columns || {}) },
    customRows: Array.isArray(invoice.customRows) ? invoice.customRows.slice(0, 8) : [],
    storeNameAr: plain.storeNameAr || DEFAULT_INVOICE.companyNameAr,
    storeNameEn: plain.storeNameEn || DEFAULT_INVOICE.companyNameEn,
    supportPhone: plain.supportPhone || '',
    supportEmail: plain.supportEmail || '',
    currency: plain.currency || 'EGP',
    logoUrl: plain.logoUrl || '',
  };
  merged.accentColor = normalizeHex(merged.accentColor, DEFAULT_INVOICE.accentColor);
  merged.pageSize = merged.pageSize === 'Letter' ? 'LETTER' : 'A4';
  return merged;
}

/* ================================================================== *
 * Helpers
 * ================================================================== */

function tint(hex, amount) {
  const h = normalizeHex(hex, '#0f766e').slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const LOGO_SIZES = { sm: 44, md: 66, lg: 96 };

function statusLabel(status, isAr) {
  const row = ORDER_STATUSES.find((s) => s.value === status);
  if (!row) return String(status || '');
  return isAr ? row.labelAr : row.labelEn;
}

function paymentStatusLabel(status, isAr) {
  const map = {
    paid: ['مدفوع', 'Paid'],
    pending: ['قيد الانتظار', 'Pending'],
    failed: ['فشل', 'Failed'],
    refunded: ['مسترد', 'Refunded'],
    partially_refunded: ['مسترد جزئياً', 'Partially refunded'],
  };
  const row = map[status];
  return row ? (isAr ? row[0] : row[1]) : String(status || '');
}

function paymentMethodLabel(method, isAr) {
  const map = {
    cod: ['الدفع عند الاستلام', 'Cash on delivery'],
    stripe: ['بطاقة ائتمان', 'Credit card'],
    instapay: ['إنستاباي', 'InstaPay'],
    vodafone_cash: ['فودافون كاش', 'Vodafone Cash'],
  };
  const row = map[method];
  return row ? (isAr ? row[0] : row[1]) : String(method || '');
}

function resolveTrackUrl(order) {
  const base = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
  if (!base || !order?._id) return '';
  return `${base}/orders/${order._id}`;
}

/**
 * Fetch an image, returning its Buffer only when it is a real PNG or JPEG.
 * Accepts http(s) URLs and data: URIs. Everything else (WebP, SVG, GIF, HTML
 * error pages) is rejected so it can never corrupt the PDF stream.
 */
async function loadImage(url) {
  if (!url) return null;
  try {
    let buf = null;
    if (/^data:/i.test(url)) {
      const comma = url.indexOf(',');
      if (comma === -1) return null;
      const meta = url.slice(5, comma);
      buf = /;base64/i.test(meta)
        ? Buffer.from(url.slice(comma + 1), 'base64')
        : Buffer.from(decodeURIComponent(url.slice(comma + 1)));
    } else if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }
    if (!buf || buf.length < 4) return null;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!isPng && !isJpeg) {
      console.warn('[invoice] image ignored — only PNG or JPEG are supported');
      return null;
    }
    return buf;
  } catch (err) {
    console.warn('[invoice] could not load image:', err.message);
    return null;
  }
}

/* ================================================================== *
 * Text engine — segment into single-direction runs and position each.
 * PDFKit renders a pure Arabic or pure Latin run correctly on its own;
 * it only mishandles direction changes inside one text() call, so we
 * never give it one.
 * ================================================================== */

const TEXT_FEATURES = []; // disable discretionary OT features; required shaping still runs

function selectFont(doc, bold) {
  doc.font(bold ? 'Bold' : 'Body');
}

/**
 * Draw one line, laying out direction runs in visual order and clipping with an
 * ellipsis when a `width` is given and the text overflows. Returns line height.
 */
function drawLine(doc, text, x, y, {
  size = 10, bold = false, color = '#111827', width, align = 'left', baseRtl: baseRtlHint,
} = {}) {
  const raw = String(text ?? '');
  selectFont(doc, bold);
  doc.fontSize(size).fillColor(color);
  const lineHeight = doc.currentLineHeight();
  if (!raw) return lineHeight;

  let { baseRtl, runs } = segmentRuns(raw, baseRtlHint);
  let visual = baseRtl ? [...runs].reverse() : runs;
  let widths = visual.map((r) => doc.widthOfString(r.text, { features: TEXT_FEATURES }));
  let total = widths.reduce((a, b) => a + b, 0);

  if (width != null && total > width) {
    // Trim from the trailing (reading-end) side, run by run, then char by char.
    const ell = '…';
    const ellW = doc.widthOfString(ell, { features: TEXT_FEATURES });
    while (visual.length && total + ellW > width) {
      const lastIdx = baseRtl ? 0 : visual.length - 1;
      const run = visual[lastIdx];
      if (run.text.length <= 1) {
        visual.splice(lastIdx, 1);
        widths.splice(lastIdx, 1);
      } else {
        run.text = baseRtl ? run.text.slice(1) : run.text.slice(0, -1);
        widths[lastIdx] = doc.widthOfString(run.text, { features: TEXT_FEATURES });
      }
      total = widths.reduce((a, b) => a + b, 0);
    }
    const ellRun = { rtl: baseRtl, text: ell };
    if (baseRtl) { visual.unshift(ellRun); widths.unshift(ellW); }
    else { visual.push(ellRun); widths.push(ellW); }
    total += ellW;
  }

  let startX = x;
  if (width != null) {
    if (align === 'right') startX = x + width - total;
    else if (align === 'center') startX = x + (width - total) / 2;
  }

  let cx = startX;
  for (let i = 0; i < visual.length; i += 1) {
    // Pin each run inside a box of its own measured width, aligned to its own
    // direction, so PDFKit cannot drift an RTL run left over its neighbour.
    doc.text(visual[i].text, cx, y, {
      lineBreak: false,
      features: TEXT_FEATURES,
      width: widths[i] + 1,
      align: visual[i].rtl ? 'right' : 'left',
    });
    cx += widths[i];
  }
  return lineHeight;
}

/** Word-wrap a (possibly multi-line) string to `width`; returns total height. */
function drawParagraph(doc, text, x, y, {
  size = 9, bold = false, color = '#334155', width, align = 'left', maxLines = 6, baseRtl,
} = {}) {
  selectFont(doc, bold);
  doc.fontSize(size);
  const lineHeight = doc.currentLineHeight() + 1;
  const paragraphs = String(text ?? '').split(/\r?\n/);
  const lines = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (width != null && doc.widthOfString(candidate, { features: TEXT_FEATURES }) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }

  const shown = lines.slice(0, maxLines);
  shown.forEach((line, i) => {
    drawLine(doc, line, x, y + i * lineHeight, { size, bold, color, width, align, baseRtl });
  });
  return shown.length * lineHeight;
}

/* ================================================================== *
 * Field pickers
 * ================================================================== */

function tr(invoice, key, isAr) {
  const suffix = isAr ? 'Ar' : 'En';
  return invoice[`${key}${suffix}`] || invoice.labels?.[`${key}${suffix}`] || '';
}
function lbl(invoice, key, isAr) {
  return invoice.labels?.[`${key}${isAr ? 'Ar' : 'En'}`] || '';
}
function itemName(item, isAr) {
  return isAr ? (item.nameAr || item.nameEn || 'منتج') : (item.nameEn || item.nameAr || 'Product');
}
function customerName(order, user, isAr) {
  return user?.name || order.user?.name || (isAr ? 'عميل' : 'Customer');
}
function addressLine(order, isAr) {
  const a = order.shippingAddress;
  if (!a) return '';
  const sep = isAr ? '، ' : ', ';
  return [a.street, a.building && `${isAr ? 'مبنى' : 'Bldg'} ${a.building}`, a.area, a.city, a.governorate]
    .filter(Boolean)
    .join(sep);
}

/* ================================================================== *
 * Generator
 * ================================================================== */

export async function generateOrderInvoicePdf(order, user, { lang = 'ar', storeSettings = null } = {}) {
  const isAr = lang === 'ar';
  const invoice = mergeInvoiceSettings(storeSettings);
  const currency = invoice.currency;
  const accent = invoice.accentColor;
  const money = (n) => `${toNumber(n).toFixed(2)} ${currency}`;
  const startAlign = isAr ? 'right' : 'left';
  const endAlign = isAr ? 'left' : 'right';

  const logoBuffer = invoice.showLogo ? await loadImage(invoice.logoUrl) : null;
  const stampBuffer = invoice.showStamp ? await loadImage(invoice.stampUrl) : null;
  const trackUrl = resolveTrackUrl(order);
  let qrBuffer = null;
  if (invoice.showQr && trackUrl) {
    try {
      qrBuffer = await QRCode.toBuffer(trackUrl, { margin: 0, width: 240, errorCorrectionLevel: 'M' });
    } catch { qrBuffer = null; }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 44, size: invoice.pageSize });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('Body', getPdfFontBuffer());
      doc.registerFont('Bold', getPdfBoldFontBuffer());

      // Bind the invoice's base text direction so every line/paragraph lays out
      // for the invoice language even when a field value is the other script.
      const L = (text, x, y, o = {}) => drawLine(doc, text, x, y, { baseRtl: isAr, ...o });
      const P = (text, x, y, o = {}) => drawParagraph(doc, text, x, y, { baseRtl: isAr, ...o });

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;

      /* ---- Header band ---- */
      const bandH = 96;
      doc.rect(0, 0, doc.page.width, bandH).fill(accent);

      const logoDim = LOGO_SIZES[invoice.logoSize] || LOGO_SIZES.md;
      let logoLeadingInset = 0;
      if (logoBuffer) {
        let lx;
        if (invoice.logoPosition === 'center') lx = (doc.page.width - logoDim) / 2;
        else if (invoice.logoPosition === 'start') { lx = isAr ? right - logoDim : left; logoLeadingInset = logoDim + 16; }
        else lx = isAr ? left : right - logoDim; // 'end'
        try {
          doc.image(logoBuffer, lx, (bandH - logoDim) / 2, { fit: [logoDim, logoDim] });
        } catch { logoLeadingInset = 0; }
      }

      const companyName = tr(invoice, 'companyName', isAr) || (isAr ? invoice.storeNameAr : invoice.storeNameEn);
      const companyAddr = tr(invoice, 'companyAddress', isAr);
      const infoX = isAr ? left : left + logoLeadingInset;
      const infoW = contentW - logoLeadingInset;

      let hy = 18;
      hy += L(companyName, infoX, hy, { size: 15, bold: true, color: '#ffffff', width: infoW, align: startAlign }) + 3;
      if (companyAddr) {
        hy += L(companyAddr, infoX, hy, { size: 8.5, color: tint(accent, 0.78), width: infoW, align: startAlign }) + 2;
      }
      const contactBits = [];
      if (invoice.supportPhone) contactBits.push(`${lbl(invoice, 'phone', isAr) || (isAr ? 'الهاتف' : 'Tel')}: ${invoice.supportPhone}`);
      if (invoice.supportEmail) contactBits.push(invoice.supportEmail);
      if (invoice.showTaxId && invoice.taxRegistrationNumber) {
        contactBits.push(`${tr(invoice, 'taxIdLabel', isAr) || (isAr ? 'الرقم الضريبي' : 'Tax ID')}: ${invoice.taxRegistrationNumber}`);
      }
      if (contactBits.length) {
        L(contactBits.join('   •   '), infoX, hy, { size: 8.5, color: tint(accent, 0.82), width: infoW, align: startAlign });
      }

      let y = bandH + 24;

      /* ---- Title ---- */
      const prefix = tr(invoice, 'documentPrefix', isAr);
      const title = tr(invoice, 'title', isAr) || lbl(invoice, 'invoice', isAr) || (isAr ? 'فاتورة' : 'Invoice');
      L(title, left, y, { size: 20, bold: true, color: '#0f172a', width: contentW, align: 'center' });
      y += 28;

      const headerNote = tr(invoice, 'headerNote', isAr);
      if (headerNote) {
        y += P(headerNote, left, y, { size: 9.5, color: '#64748b', width: contentW, align: 'center', maxLines: 2 });
      }
      y += 8;

      /* ---- Meta cards ---- */
      const gap = 14;
      const cardW = (contentW - gap) / 2;
      const displayOrderNo = `${prefix || ''}${order.orderNumber || ''}`;

      const rowsLeft = [
        [lbl(invoice, 'orderNumber', isAr) || (isAr ? 'رقم الطلب' : 'Order no.'), displayOrderNo],
        [lbl(invoice, 'date', isAr) || (isAr ? 'التاريخ' : 'Date'), formatPdfDate(order.createdAt, isAr)],
      ];
      if (invoice.showPaymentMethod && order.paymentMethod) {
        rowsLeft.push([tr(invoice, 'paymentMethodLabel', isAr) || (isAr ? 'طريقة الدفع' : 'Payment method'), paymentMethodLabel(order.paymentMethod, isAr)]);
      }
      for (const cr of invoice.customRows) {
        const k = isAr ? cr.labelAr : cr.labelEn;
        const v = isAr ? cr.valueAr : cr.valueEn;
        if (k || v) rowsLeft.push([k || '', v || '']);
      }

      const rowsRight = [
        [lbl(invoice, 'customer', isAr) || (isAr ? 'العميل' : 'Customer'), customerName(order, user, isAr)],
      ];
      if (order.phone) rowsRight.push([lbl(invoice, 'phone', isAr) || (isAr ? 'الهاتف' : 'Phone'), order.phone]);
      const addr = addressLine(order, isAr);
      if (addr) rowsRight.push([isAr ? 'العنوان' : 'Address', addr]);

      const lineH = 15;
      const cardH = Math.max(rowsLeft.length, rowsRight.length) * lineH + 18;
      const leftCardX = isAr ? left + cardW + gap : left;
      const rightCardX = isAr ? left : left + cardW + gap;

      doc.roundedRect(leftCardX, y, cardW, cardH, 8).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.roundedRect(rightCardX, y, cardW, cardH, 8).fillAndStroke('#f8fafc', '#e2e8f0');

      const pad = 12;
      const drawCardRows = (rows, cardX) => {
        let ry = y + 10;
        for (const [k, v] of rows) {
          L(`${k}: ${v}`, cardX + pad, ry, { size: 9, color: '#334155', width: cardW - pad * 2, align: startAlign });
          ry += lineH;
        }
      };
      drawCardRows(rowsLeft, leftCardX);
      drawCardRows(rowsRight, rightCardX);
      y += cardH + 22;

      /* ---- Items table ---- */
      L(lbl(invoice, 'items', isAr) || (isAr ? 'المنتجات' : 'Items'), left, y, {
        size: 12, bold: true, color: '#0f172a', width: contentW, align: startAlign,
      });
      y += 19;

      const cols = invoice.columns || {};
      const fixed = [];
      if (cols.sku) fixed.push({ key: 'sku', w: 62, label: isAr ? 'الكود' : 'SKU' });
      fixed.push({ key: 'qty', w: 44, label: lbl(invoice, 'qty', isAr) || (isAr ? 'الكمية' : 'Qty') });
      if (cols.unitPrice !== false) fixed.push({ key: 'price', w: 80, label: lbl(invoice, 'price', isAr) || (isAr ? 'السعر' : 'Price') });
      if (cols.lineTotal !== false) fixed.push({ key: 'total', w: 86, label: lbl(invoice, 'lineTotal', isAr) || (isAr ? 'المجموع' : 'Total') });
      const fixedW = fixed.reduce((s, c) => s + c.w, 0);
      const nameCol = { key: 'name', w: contentW - fixedW, label: lbl(invoice, 'item', isAr) || (isAr ? 'المنتج' : 'Product') };
      const orderedCols = isAr ? [...fixed].reverse().concat(nameCol) : [nameCol, ...fixed];

      const rowH = 19;
      const drawTableHeader = () => {
        doc.rect(left, y, contentW, 22).fill(accent);
        let cx = left;
        for (const c of orderedCols) {
          L(c.label, cx + 6, y + 6.5, {
            size: 8.5, bold: true, color: '#ffffff', width: c.w - 12,
            align: c.key === 'name' ? startAlign : 'center',
          });
          cx += c.w;
        }
        y += 22;
      };
      drawTableHeader();

      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item, i) => {
        if (y > doc.page.height - 150) {
          doc.addPage();
          y = doc.page.margins.top;
          drawTableHeader();
        }
        if (i % 2 === 1) doc.rect(left, y, contentW, rowH).fill('#f8fafc');
        let cx = left;
        for (const c of orderedCols) {
          let val = '';
          if (c.key === 'name') val = itemName(item, isAr);
          else if (c.key === 'sku') val = item.sku || '—';
          else if (c.key === 'qty') val = String(toNumber(item.quantity) || item.quantity || '');
          else if (c.key === 'price') val = money(item.price);
          else if (c.key === 'total') val = money(toNumber(item.price) * toNumber(item.quantity));
          L(val, cx + 6, y + 5, {
            size: 8.5, color: '#1f2937', width: c.w - 12,
            align: c.key === 'name' ? startAlign : 'center',
          });
          cx += c.w;
        }
        y += rowH;
      });

      y += 6;
      doc.moveTo(left, y).lineTo(right, y).strokeColor('#e2e8f0').stroke();
      y += 12;

      /* ---- Totals ---- */
      const totalsW = 260;
      const totalsX = isAr ? left : right - totalsW;
      const totalRows = [
        [lbl(invoice, 'subtotal', isAr) || (isAr ? 'المجموع الفرعي' : 'Subtotal'), money(order.subtotal)],
        [lbl(invoice, 'delivery', isAr) || (isAr ? 'التوصيل' : 'Delivery'), money(order.deliveryFee)],
      ];
      if (toNumber(order.discount) > 0) totalRows.push([lbl(invoice, 'discount', isAr) || (isAr ? 'الخصم' : 'Discount'), `- ${money(order.discount)}`]);
      if (toNumber(order.pointsDiscount) > 0) totalRows.push([lbl(invoice, 'pointsDiscount', isAr) || (isAr ? 'خصم النقاط' : 'Points discount'), `- ${money(order.pointsDiscount)}`]);

      for (const [k, v] of totalRows) {
        L(`${k}: ${v}`, totalsX, y, { size: 10, color: '#334155', width: totalsW, align: endAlign });
        y += 16;
      }

      const savings = toNumber(order.discount) + toNumber(order.pointsDiscount);
      if (invoice.showSavings && savings > 0) {
        L(`${isAr ? 'وفّرت' : 'You saved'} ${money(savings)}`, totalsX, y, {
          size: 9, bold: true, color: '#16a34a', width: totalsW, align: endAlign,
        });
        y += 16;
      }

      doc.roundedRect(totalsX, y, totalsW, 32, 6).fill(tint(accent, 0.86));
      L(`${lbl(invoice, 'grandTotal', isAr) || (isAr ? 'الإجمالي' : 'Grand total')}: ${money(order.total)}`, totalsX + 12, y + 9, {
        size: 13, bold: true, color: accent, width: totalsW - 24, align: endAlign,
      });
      y += 46;

      /* ---- Status ---- */
      if (invoice.showOrderStatus) {
        L(`${lbl(invoice, 'orderStatus', isAr) || (isAr ? 'حالة الطلب' : 'Order status')}: ${statusLabel(order.orderStatus, isAr)}`, left, y, {
          size: 9.5, color: '#475569', width: contentW, align: startAlign,
        });
        y += 15;
      }
      if (invoice.showPaymentStatus) {
        L(`${lbl(invoice, 'paymentStatus', isAr) || (isAr ? 'حالة الدفع' : 'Payment status')}: ${paymentStatusLabel(order.paymentStatus, isAr)}`, left, y, {
          size: 9.5, color: '#475569', width: contentW, align: startAlign,
        });
        y += 15;
      }

      /* ---- Bank / payment details ---- */
      const bank = tr(invoice, 'bankDetails', isAr);
      if (invoice.showBankDetails && bank) {
        y += 8;
        const bankLabel = isAr ? 'بيانات التحويل / الدفع' : 'Payment / transfer details';
        const bodyLines = String(bank).split(/\r?\n/).length + 1;
        const bh = bodyLines * 13 + 22;
        doc.roundedRect(left, y, contentW, bh, 6).fillAndStroke('#f8fafc', '#e2e8f0');
        L(bankLabel, left + 12, y + 9, { size: 8.5, bold: true, color: '#64748b', width: contentW - 24, align: startAlign });
        P(bank, left + 12, y + 24, { size: 9, color: '#334155', width: contentW - 24, align: startAlign, maxLines: 6 });
        y += bh + 8;
      }

      /* ---- Footer: note, terms, stamp, QR ---- */
      y = Math.max(y + 12, doc.page.height - 128);
      const footerNote = tr(invoice, 'footerNote', isAr);
      const terms = tr(invoice, 'terms', isAr);

      if (qrBuffer) {
        const qx = isAr ? left : right - 62;
        try {
          doc.image(qrBuffer, qx, y, { fit: [62, 62] });
          L(isAr ? 'امسح لتتبع الطلب' : 'Scan to track', qx - 14, y + 64, { size: 6.5, color: '#94a3b8', width: 90, align: 'center' });
        } catch { /* ignore */ }
      }
      if (stampBuffer) {
        const sx = isAr ? right - 92 : left;
        try { doc.image(stampBuffer, sx, y, { fit: [92, 92] }); } catch { /* ignore */ }
      }

      const sideInset = 104;
      const textFooterW = contentW - (qrBuffer ? sideInset : 0) - (stampBuffer ? sideInset : 0);
      const textFooterX = left + ((stampBuffer && !isAr) || (qrBuffer && isAr) ? sideInset : 0);
      let fy = y + 8;
      if (footerNote) {
        fy += P(footerNote, textFooterX, fy, { size: 9.5, bold: true, color: '#0f172a', width: textFooterW, align: 'center', maxLines: 2 }) + 3;
      }
      if (terms) {
        P(terms, textFooterX, fy, { size: 7.5, color: '#94a3b8', width: textFooterW, align: 'center', maxLines: 3 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateSampleInvoicePdf(storeSettings, lang = 'ar') {
  return generateOrderInvoicePdf(SAMPLE_INVOICE_ORDER, SAMPLE_INVOICE_USER, { lang, storeSettings });
}
