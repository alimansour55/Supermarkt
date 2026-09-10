import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, FileText, Plus, Trash2 } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Button from '../../../components/ui/Button';
import SettingToggleCard from '../../components/SettingToggleCard';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';
import { adminApi } from '../../adminApi';
import { downloadBlob } from '../../utils/downloadBlob';

const selectClass =
  'w-full rounded-field border border-border bg-white px-4 py-2.5 text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

function ImagePreview({ url, file, isAr, emptyText }) {
  const src = file ? URL.createObjectURL(file) : url;
  if (!src) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-4">
      <p className="mb-2 text-xs font-medium text-text-muted">{isAr ? 'المعاينة الحالية' : 'Current image'}</p>
      <img src={src} alt="" className="mx-auto h-20 max-w-full object-contain" />
    </div>
  );
}

export default function StoreInvoiceSettingsPage() {
  const {
    settings,
    loading,
    saving,
    save,
    updateInvoice,
    updateInvoiceLabel,
    updateInvoiceColumn,
    updateInvoiceRows,
    stampFile,
    setStampFile,
    isAr,
  } = useStoreSettingsForm();
  const [previewLoading, setPreviewLoading] = useState(null);

  const handlePreview = async (lang) => {
    setPreviewLoading(lang);
    try {
      const res = await adminApi.previewInvoicePdf(lang);
      downloadBlob(res.data, `invoice-preview-${lang}.pdf`);
    } finally {
      setPreviewLoading(null);
    }
  };

  if (!settings) {
    return <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save} />;
  }

  const inv = settings.invoice;
  const rows = Array.isArray(inv.customRows) ? inv.customRows : [];

  const setRow = (i, key, value) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r));
    updateInvoiceRows(next);
  };
  const addRow = () => updateInvoiceRows([...rows, { labelAr: '', labelEn: '', valueAr: '', valueEn: '' }]);
  const removeRow = (i) => updateInvoiceRows(rows.filter((_, idx) => idx !== i));

  return (
    <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save}>
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">{isAr ? 'الفاتورة PDF' : 'PDF invoice'}</h2>
              <p className="text-sm text-text-muted">
                {isAr
                  ? 'صمّم فاتورة الطلب بالكامل — التغييرات تظهر للعميل عند التحميل. المعاينة تعرض آخر نسخة محفوظة.'
                  : 'Design the full order invoice — changes appear when customers download it. Preview reflects the last saved version.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" loading={previewLoading === 'ar'} onClick={() => handlePreview('ar')}>
              <Eye className="h-4 w-4" aria-hidden />
              {isAr ? 'معاينة عربي' : 'Preview Arabic'}
            </Button>
            <Button type="button" size="sm" variant="secondary" loading={previewLoading === 'en'} onClick={() => handlePreview('en')}>
              <Eye className="h-4 w-4" aria-hidden />
              {isAr ? 'معاينة EN' : 'Preview English'}
            </Button>
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-text">{isAr ? 'اللون الأساسي' : 'Accent color'}</span>
            <span className="flex items-center gap-3">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(inv.accentColor || '') ? inv.accentColor : '#0f766e'}
                onChange={(e) => updateInvoice('accentColor', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-border bg-white"
              />
              <Input
                value={inv.accentColor || ''}
                onChange={(e) => updateInvoice('accentColor', e.target.value)}
                placeholder="#0f766e"
                className="flex-1"
              />
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-text">{isAr ? 'حجم الصفحة' : 'Page size'}</span>
            <select className={selectClass} value={inv.pageSize || 'A4'} onChange={(e) => updateInvoice('pageSize', e.target.value)}>
              <option value="A4">A4</option>
              <option value="Letter">{isAr ? 'Letter (أمريكي)' : 'Letter (US)'}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-text">{isAr ? 'موضع الشعار' : 'Logo position'}</span>
            <select className={selectClass} value={inv.logoPosition || 'end'} onChange={(e) => updateInvoice('logoPosition', e.target.value)}>
              <option value="start">{isAr ? 'البداية (يمين)' : 'Start (leading)'}</option>
              <option value="center">{isAr ? 'المنتصف' : 'Center'}</option>
              <option value="end">{isAr ? 'النهاية (يسار)' : 'End (trailing)'}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-text">{isAr ? 'حجم الشعار' : 'Logo size'}</span>
            <select className={selectClass} value={inv.logoSize || 'md'} onChange={(e) => updateInvoice('logoSize', e.target.value)}>
              <option value="sm">{isAr ? 'صغير' : 'Small'}</option>
              <option value="md">{isAr ? 'متوسط' : 'Medium'}</option>
              <option value="lg">{isAr ? 'كبير' : 'Large'}</option>
            </select>
          </label>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <ImagePreview
            url={settings.logoUrl}
            isAr={isAr}
            emptyText={isAr ? 'لم يُرفع شعار بعد. ارفعه من هوية المتجر.' : 'No logo uploaded yet — upload it in Store identity.'}
          />
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-border bg-slate-50/60 p-4 text-sm">
            <p className="text-text-muted">
              {isAr
                ? 'الشعار يُرفع من إعدادات هوية المتجر ويظهر في الفاتورة عند تفعيل «إظهار الشعار».'
                : 'The logo is uploaded in Store identity settings and shows on the invoice when “Show logo” is on.'}
            </p>
            <Link to="/admin/settings/identity" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline">
              {isAr ? 'فتح هوية المتجر' : 'Open store identity'}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        {/* Display toggles */}
        <h3 className="mb-3 text-sm font-bold">{isAr ? 'ما الذي يظهر في الفاتورة' : 'What appears on the invoice'}</h3>
        <div className="space-y-3">
          <SettingToggleCard checked={inv.showLogo} onChange={(v) => updateInvoice('showLogo', v)} title={isAr ? 'إظهار الشعار' : 'Show logo'} />
          <SettingToggleCard checked={inv.showTaxId} onChange={(v) => updateInvoice('showTaxId', v)} title={isAr ? 'إظهار الرقم الضريبي' : 'Show tax ID'} />
          <SettingToggleCard checked={inv.showPaymentMethod} onChange={(v) => updateInvoice('showPaymentMethod', v)} title={isAr ? 'إظهار طريقة الدفع' : 'Show payment method'} />
          <SettingToggleCard checked={inv.showOrderStatus} onChange={(v) => updateInvoice('showOrderStatus', v)} title={isAr ? 'إظهار حالة الطلب' : 'Show order status'} />
          <SettingToggleCard checked={inv.showPaymentStatus} onChange={(v) => updateInvoice('showPaymentStatus', v)} title={isAr ? 'إظهار حالة الدفع' : 'Show payment status'} />
          <SettingToggleCard checked={inv.showSavings} onChange={(v) => updateInvoice('showSavings', v)} title={isAr ? 'إظهار قيمة التوفير' : 'Show total savings'} />
          <SettingToggleCard checked={inv.showQr} onChange={(v) => updateInvoice('showQr', v)} title={isAr ? 'إظهار رمز QR لتتبع الطلب' : 'Show QR code to track the order'} />
          <SettingToggleCard checked={inv.showBankDetails} onChange={(v) => updateInvoice('showBankDetails', v)} title={isAr ? 'إظهار بيانات التحويل / الدفع' : 'Show payment / transfer details'} />
          <SettingToggleCard checked={inv.showStamp} onChange={(v) => updateInvoice('showStamp', v)} title={isAr ? 'إظهار الختم / التوقيع' : 'Show stamp / signature'} />
        </div>

        <h3 className="mb-3 mt-6 text-sm font-bold">{isAr ? 'أعمدة جدول المنتجات' : 'Product table columns'}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingToggleCard checked={inv.columns?.sku} onChange={(v) => updateInvoiceColumn('sku', v)} title={isAr ? 'عمود الكود (SKU)' : 'SKU column'} />
          <SettingToggleCard checked={inv.columns?.unitPrice !== false} onChange={(v) => updateInvoiceColumn('unitPrice', v)} title={isAr ? 'عمود سعر الوحدة' : 'Unit price column'} />
          <SettingToggleCard checked={inv.columns?.lineTotal !== false} onChange={(v) => updateInvoiceColumn('lineTotal', v)} title={isAr ? 'عمود إجمالي السطر' : 'Line total column'} />
        </div>

        {/* Seller & payment details */}
        <details className="mt-6 rounded-xl border border-border bg-slate-50/40 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold">{isAr ? 'بيانات البائع والدفع' : 'Seller & payment details'}</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Textarea
              label={isAr ? 'بيانات التحويل / الدفع (عربي)' : 'Payment / transfer details AR'}
              value={inv.bankDetailsAr || ''}
              onChange={(e) => updateInvoice('bankDetailsAr', e.target.value)}
              rows={3}
              placeholder={isAr ? 'بنك مصر — حساب رقم 123...' : ''}
            />
            <Textarea
              label={isAr ? 'بيانات التحويل / الدفع (EN)' : 'Payment / transfer details EN'}
              value={inv.bankDetailsEn || ''}
              onChange={(e) => updateInvoice('bankDetailsEn', e.target.value)}
              rows={3}
            />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-text">{isAr ? 'صفوف مخصّصة (تظهر في بطاقة بيانات الطلب)' : 'Custom rows (shown in the order-details card)'}</span>
              <Button type="button" size="sm" variant="secondary" onClick={addRow} disabled={rows.length >= 8}>
                <Plus className="h-4 w-4" aria-hidden />
                {isAr ? 'إضافة صف' : 'Add row'}
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-text-muted">{isAr ? 'مثال: السجل التجاري، اسم المندوب، رقم أمر الشراء…' : 'e.g. Commercial register, sales rep, PO number…'}</p>
            ) : (
              <div className="space-y-3">
                {rows.map((r, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                    <Input placeholder={isAr ? 'التسمية (عربي)' : 'Label AR'} value={r.labelAr || ''} onChange={(e) => setRow(i, 'labelAr', e.target.value)} />
                    <Input placeholder={isAr ? 'التسمية (EN)' : 'Label EN'} value={r.labelEn || ''} onChange={(e) => setRow(i, 'labelEn', e.target.value)} />
                    <Input placeholder={isAr ? 'القيمة (عربي)' : 'Value AR'} value={r.valueAr || ''} onChange={(e) => setRow(i, 'valueAr', e.target.value)} />
                    <Input placeholder={isAr ? 'القيمة (EN)' : 'Value EN'} value={r.valueEn || ''} onChange={(e) => setRow(i, 'valueEn', e.target.value)} />
                    <button type="button" onClick={() => removeRow(i)} className="flex items-center justify-center rounded-lg border border-border px-3 text-danger-600 hover:bg-danger-50" aria-label={isAr ? 'حذف' : 'Remove'}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ImagePreview
              url={inv.stampUrl}
              file={stampFile}
              isAr={isAr}
              emptyText={isAr ? 'لا يوجد ختم مرفوع.' : 'No stamp uploaded.'}
            />
            <div className="flex flex-col justify-center gap-2 text-sm">
              <label className="font-medium text-text">{isAr ? 'رفع الختم / التوقيع (PNG أو JPEG)' : 'Upload stamp / signature (PNG or JPEG)'}</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setStampFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              {(inv.stampUrl || stampFile) && (
                <button
                  type="button"
                  onClick={() => { setStampFile(null); updateInvoice('stampUrl', ''); }}
                  className="self-start text-xs font-medium text-danger-600 hover:underline"
                >
                  {isAr ? 'إزالة الختم' : 'Remove stamp'}
                </button>
              )}
              <p className="text-xs text-text-muted">{isAr ? 'يظهر أسفل الفاتورة عند تفعيل «إظهار الختم».' : 'Appears at the bottom of the invoice when “Show stamp” is on.'}</p>
            </div>
          </div>
        </details>

        {/* Text & company */}
        <details className="mt-4 rounded-xl border border-border bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'النصوص وبيانات الشركة (عربي / English)' : 'Text and company details (Arabic / English)'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label={isAr ? 'عنوان الفاتورة (عربي)' : 'Invoice title AR'} value={inv.titleAr} onChange={(e) => updateInvoice('titleAr', e.target.value)} />
            <Input label={isAr ? 'عنوان الفاتورة (EN)' : 'Invoice title EN'} value={inv.titleEn} onChange={(e) => updateInvoice('titleEn', e.target.value)} />
            <Input label={isAr ? 'بادئة رقم المستند (عربي)' : 'Document prefix AR'} value={inv.documentPrefixAr || ''} onChange={(e) => updateInvoice('documentPrefixAr', e.target.value)} placeholder="INV-" />
            <Input label={isAr ? 'بادئة رقم المستند (EN)' : 'Document prefix EN'} value={inv.documentPrefixEn || ''} onChange={(e) => updateInvoice('documentPrefixEn', e.target.value)} placeholder="INV-" />
            <Input label={isAr ? 'اسم الشركة (عربي)' : 'Company name AR'} value={inv.companyNameAr} onChange={(e) => updateInvoice('companyNameAr', e.target.value)} />
            <Input label={isAr ? 'اسم الشركة (EN)' : 'Company name EN'} value={inv.companyNameEn} onChange={(e) => updateInvoice('companyNameEn', e.target.value)} />
            <Textarea label={isAr ? 'عنوان الشركة (عربي)' : 'Company address AR'} value={inv.companyAddressAr} onChange={(e) => updateInvoice('companyAddressAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'عنوان الشركة (EN)' : 'Company address EN'} value={inv.companyAddressEn} onChange={(e) => updateInvoice('companyAddressEn', e.target.value)} rows={2} />
            <Input label={isAr ? 'الرقم الضريبي' : 'Tax registration no.'} value={inv.taxRegistrationNumber} onChange={(e) => updateInvoice('taxRegistrationNumber', e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input label={isAr ? 'تسمية الرقم الضريبي (عربي)' : 'Tax ID label AR'} value={inv.taxIdLabelAr || ''} onChange={(e) => updateInvoice('taxIdLabelAr', e.target.value)} />
              <Input label={isAr ? 'تسمية الرقم الضريبي (EN)' : 'Tax ID label EN'} value={inv.taxIdLabelEn || ''} onChange={(e) => updateInvoice('taxIdLabelEn', e.target.value)} />
            </div>
            <Textarea label={isAr ? 'ملاحظة أعلى الفاتورة (عربي)' : 'Header note AR'} value={inv.headerNoteAr} onChange={(e) => updateInvoice('headerNoteAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'ملاحظة أعلى الفاتورة (EN)' : 'Header note EN'} value={inv.headerNoteEn} onChange={(e) => updateInvoice('headerNoteEn', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'ملاحظة أسفل الفاتورة (عربي)' : 'Footer note AR'} value={inv.footerNoteAr} onChange={(e) => updateInvoice('footerNoteAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'ملاحظة أسفل الفاتورة (EN)' : 'Footer note EN'} value={inv.footerNoteEn} onChange={(e) => updateInvoice('footerNoteEn', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'الشروط (عربي)' : 'Terms AR'} value={inv.termsAr} onChange={(e) => updateInvoice('termsAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'الشروط (EN)' : 'Terms EN'} value={inv.termsEn} onChange={(e) => updateInvoice('termsEn', e.target.value)} rows={2} />
          </div>
        </details>

        {/* Table labels */}
        <details className="mt-4 rounded-xl border border-border bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تخصيص عناوين الجدول (متقدم)' : 'Customize table labels (advanced)'}
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ['itemAr', 'itemEn', isAr ? 'عمود المنتج' : 'Product column'],
              ['qtyAr', 'qtyEn', isAr ? 'عمود الكمية' : 'Qty column'],
              ['priceAr', 'priceEn', isAr ? 'عمود السعر' : 'Price column'],
              ['lineTotalAr', 'lineTotalEn', isAr ? 'عمود المجموع' : 'Line total column'],
              ['subtotalAr', 'subtotalEn', isAr ? 'المجموع الفرعي' : 'Subtotal'],
              ['deliveryAr', 'deliveryEn', isAr ? 'التوصيل' : 'Delivery'],
              ['discountAr', 'discountEn', isAr ? 'الخصم' : 'Discount'],
              ['grandTotalAr', 'grandTotalEn', isAr ? 'الإجمالي' : 'Grand total'],
            ].map(([arKey, enKey, labelText]) => (
              <div key={arKey} className="grid gap-2 sm:grid-cols-2">
                <Input label={`${labelText} AR`} value={inv.labels?.[arKey] || ''} onChange={(e) => updateInvoiceLabel(arKey, e.target.value)} />
                <Input label={`${labelText} EN`} value={inv.labels?.[enKey] || ''} onChange={(e) => updateInvoiceLabel(enKey, e.target.value)} />
              </div>
            ))}
          </div>
        </details>
      </section>
    </SettingsFormShell>
  );
}
