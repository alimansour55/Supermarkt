import PDFDocument from 'pdfkit';
import { ORDER_STATUSES } from '../constants/orderStatuses.js';
import {
  DEFAULT_INVOICE,
  SAMPLE_INVOICE_ORDER,
  SAMPLE_INVOICE_USER,
} from '../constants/invoiceDefaults.js';
import {
  formatPdfDate,
  prepareArabicLine,
  prepareLatinLine,
  containsArabic,
  getArabicFontBuffer,
} from '../utils/arabicPdfText.js';

export { SAMPLE_INVOICE_ORDER, SAMPLE_INVOICE_USER };

function plainSettings(storeSettings) {
  if (!storeSettings) return {};
  if (typeof storeSettings.toObject === 'function') return storeSettings.toObject();
  return storeSettings;
}

function mergeInvoiceSettings(storeSettings = {}) {
  const plain = plainSettings(storeSettings);
  const invoice = plain.invoice || {};
  return {
    ...DEFAULT_INVOICE,
    ...invoice,
    labels: { ...DEFAULT_INVOICE.labels, ...(invoice.labels || {}) },
    storeNameAr: plain.storeNameAr || DEFAULT_INVOICE.companyNameAr,
    storeNameEn: plain.storeNameEn || DEFAULT_INVOICE.companyNameEn,
    supportPhone: plain.supportPhone || '19999',
    supportEmail: plain.supportEmail || 'support@marketplus.eg',
    currency: plain.currency || 'EGP',
    logoUrl: plain.logoUrl || '',
  };
}

function statusLabel(status, lang = 'en') {
  const row = ORDER_STATUSES.find((s) => s.value === status);
  if (!row) return status;
  return lang === 'ar' ? row.labelAr : row.labelEn;
}

function paymentLabel(status, isAr) {
  const map = {
    paid: isAr ? 'مدفوع' : 'Paid',
    pending: isAr ? 'قيد الانتظار' : 'Pending',
    failed: isAr ? 'فشل' : 'Failed',
    refunded: isAr ? 'مسترد' : 'Refunded',
  };
  return map[status] || status;
}

function pickLang(invoice, key, isAr) {
  return isAr ? (invoice[`${key}Ar`] || invoice.labels?.[`${key}Ar`]) : (invoice[`${key}En`] || invoice.labels?.[`${key}En`]);
}

function label(invoice, key, isAr) {
  const labels = invoice.labels || {};
  return isAr ? labels[`${key}Ar`] : labels[`${key}En`];
}

function formatMoney(amount, currency) {
  return `${Number(amount || 0).toFixed(2)} ${currency}`;
}

async function fetchImageBuffer(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function setupFonts(doc) {
  const arabicFont = getArabicFontBuffer();
  doc.registerFont('Latin', 'Helvetica');
  doc.registerFont('Latin-Bold', 'Helvetica-Bold');
  doc.registerFont('Arabic', arabicFont);
  doc.registerFont('Arabic-Bold', arabicFont);
}

function pickFont(isAr, bold = false) {
  if (isAr) return bold ? 'Arabic-Bold' : 'Arabic';
  return bold ? 'Latin-Bold' : 'Latin';
}

function prepareText(text, isAr) {
  const raw = String(text ?? '');
  if (!raw) return '';
  if (isAr || containsArabic(raw)) return prepareArabicLine(raw);
  return prepareLatinLine(raw);
}

function writeText(doc, text, x, y, {
  isAr = false,
  bold = false,
  size = 10,
  color = '#111',
  width,
  align = 'left',
} = {}) {
  const useArabic = isAr || containsArabic(text);
  doc.font(pickFont(useArabic, bold)).fontSize(size).fillColor(color);
  doc.text(prepareText(text, useArabic), x, y, { width, align });
}

function writeLatin(doc, text, x, y, options = {}) {
  writeText(doc, text, x, y, { ...options, isAr: false });
}

function writeAr(doc, text, x, y, options = {}) {
  writeText(doc, text, x, y, { ...options, isAr: true, align: options.align || 'right' });
}

function writeAuto(doc, text, x, y, options = {}) {
  const useArabic = containsArabic(text);
  writeText(doc, text, x, y, {
    ...options,
    isAr: useArabic,
    align: options.align || (useArabic ? 'right' : 'left'),
  });
}

function writeLabelValue(doc, lbl, value, x, y, {
  width,
  size = 10,
  color = '#111',
  bold = false,
  align = 'right',
  rtl = false,
} = {}) {
  if (!rtl) {
    writeAuto(doc, `${lbl}: ${value}`, x, y, { bold, size, color, width, align });
    return;
  }

  const valueText = prepareLatinLine(String(value ?? ''));
  doc.font('Latin').fontSize(size).fillColor(color);
  const valueWidth = doc.widthOfString(valueText);
  const gap = 6;
  const labelAreaWidth = Math.max(40, width - valueWidth - gap);
  const valueX = x + width - valueWidth;
  const labelX = x;

  doc.text(valueText, valueX, y, { lineBreak: false });
  writeAr(doc, `${lbl}:`, labelX, y, { bold, size, color, width: labelAreaWidth, align: 'right' });
}

function itemDisplayName(item, isAr) {
  if (isAr) return item.nameAr || item.nameEn || 'منتج';
  return item.nameEn || item.nameAr || 'Product';
}

function customerDisplayName(order, user, isAr) {
  const name = user?.name || order.user?.name;
  if (name) return name;
  return isAr ? 'عميل' : 'Customer';
}

/**
 * Generate order invoice PDF buffer.
 */
export async function generateOrderInvoicePdf(order, user, { lang = 'ar', storeSettings = null } = {}) {
  const isAr = lang === 'ar';
  const invoice = mergeInvoiceSettings(storeSettings);
  const logoBuffer = invoice.showLogo && invoice.logoUrl ? await fetchImageBuffer(invoice.logoUrl) : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    setupFonts(doc);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    let y = doc.page.margins.top;

    if (logoBuffer) {
      try {
        const logoX = isAr ? right - 72 : left;
        doc.image(logoBuffer, logoX, y, { fit: [72, 72] });
      } catch {
        // ignore broken logo
      }
    }

    const companyName = pickLang(invoice, 'companyName', isAr) || (isAr ? invoice.storeNameAr : invoice.storeNameEn);
    const companyAddress = pickLang(invoice, 'companyAddress', isAr);
    const headerX = isAr ? left : right - 240;
    const headerWidth = isAr ? pageWidth - 80 : 240;
    const headerAlign = isAr ? 'right' : 'right';

    if (isAr) {
      writeAr(doc, companyName, headerX, y, { bold: true, size: 16, width: headerWidth, align: headerAlign });
      y += 22;
      writeAr(doc, companyAddress, headerX, y, { size: 9, color: '#555', width: headerWidth, align: headerAlign });
      y += 14;
      if (invoice.supportPhone) {
        writeLabelValue(doc, label(invoice, 'phone', true), invoice.supportPhone, headerX, y, {
          size: 9, color: '#555', width: headerWidth, rtl: true,
        });
        y += 12;
      }
      if (invoice.supportEmail) {
        writeLatin(doc, invoice.supportEmail, headerX, y, { size: 9, color: '#555', width: headerWidth, align: 'right' });
        y += 12;
      }
      if (invoice.showTaxId && invoice.taxRegistrationNumber) {
        const taxLbl = pickLang(invoice, 'taxIdLabel', isAr) || 'الرقم الضريبي';
        writeLabelValue(doc, taxLbl, invoice.taxRegistrationNumber, headerX, y, {
          size: 9, color: '#555', width: headerWidth, rtl: true,
        });
        y += 12;
      }
    } else {
      writeLatin(doc, companyName, headerX, y, { bold: true, size: 16, width: headerWidth, align: headerAlign });
      y += 22;
      writeLatin(doc, companyAddress, headerX, y, { size: 9, color: '#555', width: headerWidth, align: headerAlign });
      y += 14;
      if (invoice.supportPhone) {
        writeLatin(doc, `${label(invoice, 'phone', false)}: ${invoice.supportPhone}`, headerX, y, {
          size: 9, color: '#555', width: headerWidth, align: 'right',
        });
        y += 12;
      }
      if (invoice.supportEmail) {
        writeLatin(doc, invoice.supportEmail, headerX, y, { size: 9, color: '#555', width: headerWidth, align: 'right' });
        y += 12;
      }
      if (invoice.showTaxId && invoice.taxRegistrationNumber) {
        const taxLbl = pickLang(invoice, 'taxIdLabel', false) || 'Tax ID';
        writeLatin(doc, `${taxLbl}: ${invoice.taxRegistrationNumber}`, headerX, y, {
          size: 9, color: '#555', width: headerWidth, align: 'right',
        });
        y += 12;
      }
    }

    y = Math.max(y, doc.page.margins.top + 78);
    doc.moveTo(left, y).lineTo(right, y).stroke('#e5e7eb');
    y += 18;

    const title = pickLang(invoice, 'title', isAr) || label(invoice, 'invoice', isAr);
    if (isAr) writeAr(doc, title, left, y, { bold: true, size: 22, width: pageWidth, align: 'center' });
    else writeLatin(doc, title, left, y, { bold: true, size: 22, width: pageWidth, align: 'center' });
    y += 28;

    const headerNote = pickLang(invoice, 'headerNote', isAr);
    if (headerNote) {
      writeAuto(doc, headerNote, left, y, { size: 10, color: '#555', width: pageWidth, align: 'center' });
      y += 20;
    }

    const boxHeight = 64;
    doc.roundedRect(left, y, pageWidth / 2 - 8, boxHeight, 8).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.roundedRect(left + pageWidth / 2 + 8, y, pageWidth / 2 - 8, boxHeight, 8).fillAndStroke('#f8fafc', '#e2e8f0');

    const leftBoxX = left + 12;
    const rightBoxX = left + pageWidth / 2 + 20;
    const boxWidth = pageWidth / 2 - 32;

    if (isAr) {
      writeAr(doc, label(invoice, 'orderNumber', true), leftBoxX, y + 10, { bold: true, size: 9, width: boxWidth, align: 'right' });
      writeLatin(doc, order.orderNumber, leftBoxX, y + 24, { size: 11, width: boxWidth, align: 'right' });
      writeAr(doc, label(invoice, 'date', true), leftBoxX, y + 40, { bold: true, size: 9, width: boxWidth, align: 'right' });
      writeAuto(doc, formatPdfDate(order.createdAt, true), leftBoxX, y + 52, { size: 10, width: boxWidth, align: 'right' });

      writeAr(doc, label(invoice, 'customer', true), rightBoxX, y + 10, { bold: true, size: 9, width: boxWidth, align: 'right' });
      writeAuto(doc, customerDisplayName(order, user, true), rightBoxX, y + 24, { size: 10, width: boxWidth, align: 'right' });
      writeLatin(doc, order.phone, rightBoxX, y + 38, { size: 9, color: '#555', width: boxWidth, align: 'right' });
      const addr = order.shippingAddress;
      if (addr) {
        const addressLine = [addr.street, addr.building, addr.area, addr.city, addr.governorate].filter(Boolean).join('، ');
        writeAr(doc, addressLine, rightBoxX, y + 50, { size: 8, color: '#555', width: boxWidth, align: 'right' });
      }
    } else {
      writeLatin(doc, label(invoice, 'orderNumber', false), leftBoxX, y + 10, { bold: true, size: 9 });
      writeLatin(doc, order.orderNumber, leftBoxX, y + 24, { size: 11 });
      writeLatin(doc, label(invoice, 'date', false), leftBoxX, y + 40, { bold: true, size: 9 });
      writeLatin(doc, formatPdfDate(order.createdAt, false), leftBoxX, y + 52, { size: 10 });

      writeLatin(doc, label(invoice, 'customer', false), rightBoxX, y + 10, { bold: true, size: 9 });
      writeLatin(doc, customerDisplayName(order, user, false), rightBoxX, y + 24, { size: 10 });
      writeLatin(doc, order.phone, rightBoxX, y + 38, { size: 9, color: '#555' });
      const addr = order.shippingAddress;
      if (addr) {
        const addressLine = [addr.street, addr.building, addr.area, addr.city, addr.governorate].filter(Boolean).join(', ');
        writeAuto(doc, addressLine, rightBoxX, y + 50, { size: 8, color: '#555', width: boxWidth });
      }
    }

    y += boxHeight + 20;

    if (isAr) writeAr(doc, label(invoice, 'items', true), left, y, { bold: true, size: 12, width: pageWidth, align: 'right' });
    else writeLatin(doc, label(invoice, 'items', false), left, y, { bold: true, size: 12 });
    y += 16;

    const colTotal = left + 8;
    const colPrice = left + 68;
    const colQty = left + 138;
    const colItem = left + 188;
    const itemColWidth = pageWidth - 196;

    doc.rect(left, y, pageWidth, 20).fill('#0f766e');
    doc.fillColor('#fff');

    if (isAr) {
      writeAr(doc, label(invoice, 'lineTotal', true), colTotal, y + 5, { bold: true, size: 9, color: '#fff', width: 56, align: 'center' });
      writeAr(doc, label(invoice, 'price', true), colPrice, y + 5, { bold: true, size: 9, color: '#fff', width: 64, align: 'center' });
      writeAr(doc, label(invoice, 'qty', true), colQty, y + 5, { bold: true, size: 9, color: '#fff', width: 44, align: 'center' });
      writeAr(doc, label(invoice, 'item', true), colItem, y + 5, { bold: true, size: 9, color: '#fff', width: itemColWidth, align: 'right' });
    } else {
      writeLatin(doc, label(invoice, 'item', false), left + 8, y + 5, { bold: true, size: 9, color: '#fff', width: itemColWidth });
      writeLatin(doc, label(invoice, 'qty', false), colQty, y + 5, { bold: true, size: 9, color: '#fff', width: 44, align: 'center' });
      writeLatin(doc, label(invoice, 'price', false), colPrice, y + 5, { bold: true, size: 9, color: '#fff', width: 64, align: 'right' });
      writeLatin(doc, label(invoice, 'lineTotal', false), colTotal, y + 5, { bold: true, size: 9, color: '#fff', width: 56, align: 'right' });
    }
    y += 22;

    (order.items || []).forEach((item, index) => {
      if (y > doc.page.height - 160) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      if (index % 2 === 0) {
        doc.rect(left, y - 2, pageWidth, 18).fill('#f8fafc');
      }

      const name = itemDisplayName(item, isAr);
      const money = (amount) => formatMoney(amount, invoice.currency);

      if (isAr) {
        writeLatin(doc, money(item.price * item.quantity), colTotal, y, { size: 9, width: 56, align: 'center' });
        writeLatin(doc, money(item.price), colPrice, y, { size: 9, width: 64, align: 'center' });
        writeLatin(doc, String(item.quantity), colQty, y, { size: 9, width: 44, align: 'center' });
        writeAr(doc, name, colItem, y, { size: 9, width: itemColWidth, align: 'right' });
      } else {
        writeLatin(doc, name, left + 8, y, { size: 9, width: itemColWidth });
        writeLatin(doc, String(item.quantity), colQty, y, { size: 9, width: 44, align: 'center' });
        writeLatin(doc, money(item.price), colPrice, y, { size: 9, width: 64, align: 'right' });
        writeLatin(doc, money(item.price * item.quantity), colTotal, y, { size: 9, width: 56, align: 'right' });
      }
      y += 18;
    });

    y += 8;
    doc.moveTo(left, y).lineTo(right, y).stroke('#e5e7eb');
    y += 12;

    const totals = [
      [label(invoice, 'subtotal', isAr), order.subtotal],
      [label(invoice, 'delivery', isAr), order.deliveryFee],
    ];
    if (order.discount > 0) totals.push([label(invoice, 'discount', isAr), -order.discount]);
    if (order.pointsDiscount > 0) totals.push([label(invoice, 'pointsDiscount', isAr), -order.pointsDiscount]);

    totals.forEach(([lbl, value]) => {
      const amount = formatMoney(Math.abs(value), invoice.currency);
      writeLabelValue(doc, lbl, amount, left, y, {
        size: 10, width: pageWidth, align: 'right', rtl: isAr,
      });
      y += 14;
    });

    doc.rect(left + pageWidth - 220, y, 220, 28).fill('#ecfdf5');
    const grandLabel = label(invoice, 'grandTotal', isAr);
    const grandAmount = formatMoney(order.total, invoice.currency);
    writeLabelValue(doc, grandLabel, grandAmount, left, y + 7, {
      bold: true, size: 13, color: '#047857', width: pageWidth, align: 'right', rtl: isAr,
    });
    y += 40;

    if (invoice.showOrderStatus || invoice.showPaymentStatus) {
      if (invoice.showOrderStatus) {
        if (isAr) {
          writeLabelValue(doc, label(invoice, 'orderStatus', true), statusLabel(order.orderStatus, lang), left, y, {
            size: 10, color: '#555', width: pageWidth, rtl: true,
          });
        } else {
          writeLatin(doc, `${label(invoice, 'orderStatus', false)}: ${statusLabel(order.orderStatus, lang)}`, left, y, {
            size: 10, color: '#555', width: pageWidth,
          });
        }
        y += 14;
      }
      if (invoice.showPaymentStatus) {
        if (isAr) {
          writeLabelValue(doc, label(invoice, 'paymentStatus', true), paymentLabel(order.paymentStatus, true), left, y, {
            size: 10, color: '#555', width: pageWidth, rtl: true,
          });
        } else {
          writeLatin(doc, `${label(invoice, 'paymentStatus', false)}: ${paymentLabel(order.paymentStatus, false)}`, left, y, {
            size: 10, color: '#555', width: pageWidth,
          });
        }
        y += 14;
      }
    }

    const footerNote = pickLang(invoice, 'footerNote', isAr);
    if (footerNote) {
      y += 6;
      writeAuto(doc, footerNote, left, y, { bold: true, size: 10, width: pageWidth, align: 'center' });
      y += 18;
    }

    const terms = pickLang(invoice, 'terms', isAr);
    if (terms) {
      writeAuto(doc, terms, left, y, { size: 8, color: '#64748b', width: pageWidth, align: 'center' });
    }

    doc.end();
  });
}

export async function generateSampleInvoicePdf(storeSettings, lang = 'ar') {
  return generateOrderInvoicePdf(SAMPLE_INVOICE_ORDER, SAMPLE_INVOICE_USER, { lang, storeSettings });
}
