import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, FileText } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Button from '../../../components/ui/Button';
import SettingToggleCard from '../../components/SettingToggleCard';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';
import { adminApi } from '../../adminApi';
import { downloadBlob } from '../../utils/downloadBlob';

function LogoPreview({ logoUrl, isAr }) {
  if (!logoUrl) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
        {isAr
          ? 'لم يُرفع شعار بعد. ارفع الشعار من صفحة هوية المتجر.'
          : 'No logo uploaded yet. Upload your logo from Store identity settings.'}
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-4">
      <p className="mb-2 text-xs font-medium text-text-muted">{isAr ? 'الشعار الحالي' : 'Current logo'}</p>
      <img src={logoUrl} alt="" className="mx-auto h-20 max-w-full object-contain" />
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
                  ? 'صمّم فاتورة الطلب — التغييرات تظهر للعميل عند التحميل'
                  : 'Design the order invoice — changes appear when customers download it'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={previewLoading === 'ar'}
              onClick={() => handlePreview('ar')}
            >
              <Eye className="h-4 w-4" aria-hidden />
              {isAr ? 'معاينة عربي' : 'Preview Arabic'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={previewLoading === 'en'}
              onClick={() => handlePreview('en')}
            >
              <Eye className="h-4 w-4" aria-hidden />
              {isAr ? 'معاينة EN' : 'Preview English'}
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <LogoPreview logoUrl={settings.logoUrl} isAr={isAr} />
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-border bg-slate-50/60 p-4 text-sm">
            <p className="text-text-muted">
              {isAr
                ? 'الشعار يُرفع من إعدادات هوية المتجر ويظهر في الفاتورة عند تفعيل «إظهار الشعار».'
                : 'The logo is uploaded in Store identity settings and appears on the invoice when “Show logo” is enabled.'}
            </p>
            <Link
              to="/admin/settings/identity"
              className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline"
            >
              {isAr ? 'فتح هوية المتجر' : 'Open store identity'}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <SettingToggleCard
            checked={settings.invoice.showLogo}
            onChange={(v) => updateInvoice('showLogo', v)}
            title={isAr ? 'إظهار الشعار' : 'Show logo'}
          />
          <SettingToggleCard
            checked={settings.invoice.showTaxId}
            onChange={(v) => updateInvoice('showTaxId', v)}
            title={isAr ? 'إظهار الرقم الضريبي' : 'Show tax ID'}
          />
          <SettingToggleCard
            checked={settings.invoice.showOrderStatus}
            onChange={(v) => updateInvoice('showOrderStatus', v)}
            title={isAr ? 'إظهار حالة الطلب' : 'Show order status'}
          />
          <SettingToggleCard
            checked={settings.invoice.showPaymentStatus}
            onChange={(v) => updateInvoice('showPaymentStatus', v)}
            title={isAr ? 'إظهار حالة الدفع' : 'Show payment status'}
          />
        </div>

        <details className="mt-6 rounded-xl border border-border bg-slate-50/40 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل النصوص والشركة (عربي / English)' : 'Text and company details (Arabic / English)'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label={isAr ? 'عنوان الفاتورة (عربي)' : 'Invoice title AR'} value={settings.invoice.titleAr} onChange={(e) => updateInvoice('titleAr', e.target.value)} />
            <Input label={isAr ? 'عنوان الفاتورة (EN)' : 'Invoice title EN'} value={settings.invoice.titleEn} onChange={(e) => updateInvoice('titleEn', e.target.value)} />
            <Input label={isAr ? 'اسم الشركة (عربي)' : 'Company name AR'} value={settings.invoice.companyNameAr} onChange={(e) => updateInvoice('companyNameAr', e.target.value)} />
            <Input label={isAr ? 'اسم الشركة (EN)' : 'Company name EN'} value={settings.invoice.companyNameEn} onChange={(e) => updateInvoice('companyNameEn', e.target.value)} />
            <Textarea label={isAr ? 'عنوان الشركة (عربي)' : 'Company address AR'} value={settings.invoice.companyAddressAr} onChange={(e) => updateInvoice('companyAddressAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'عنوان الشركة (EN)' : 'Company address EN'} value={settings.invoice.companyAddressEn} onChange={(e) => updateInvoice('companyAddressEn', e.target.value)} rows={2} />
            <Input label={isAr ? 'الرقم الضريبي' : 'Tax registration no.'} value={settings.invoice.taxRegistrationNumber} onChange={(e) => updateInvoice('taxRegistrationNumber', e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input label={isAr ? 'تسمية الرقم الضريبي (عربي)' : 'Tax ID label AR'} value={settings.invoice.taxIdLabelAr || ''} onChange={(e) => updateInvoice('taxIdLabelAr', e.target.value)} />
              <Input label={isAr ? 'تسمية الرقم الضريبي (EN)' : 'Tax ID label EN'} value={settings.invoice.taxIdLabelEn || ''} onChange={(e) => updateInvoice('taxIdLabelEn', e.target.value)} />
            </div>
            <Textarea label={isAr ? 'ملاحظة أعلى الفاتورة (عربي)' : 'Header note AR'} value={settings.invoice.headerNoteAr} onChange={(e) => updateInvoice('headerNoteAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'ملاحظة أعلى الفاتورة (EN)' : 'Header note EN'} value={settings.invoice.headerNoteEn} onChange={(e) => updateInvoice('headerNoteEn', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'ملاحظة أسفل الفاتورة (عربي)' : 'Footer note AR'} value={settings.invoice.footerNoteAr} onChange={(e) => updateInvoice('footerNoteAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'ملاحظة أسفل الفاتورة (EN)' : 'Footer note EN'} value={settings.invoice.footerNoteEn} onChange={(e) => updateInvoice('footerNoteEn', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'الشروط (عربي)' : 'Terms AR'} value={settings.invoice.termsAr} onChange={(e) => updateInvoice('termsAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'الشروط (EN)' : 'Terms EN'} value={settings.invoice.termsEn} onChange={(e) => updateInvoice('termsEn', e.target.value)} rows={2} />
          </div>
        </details>

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
                <Input label={`${labelText} AR`} value={settings.invoice.labels?.[arKey] || ''} onChange={(e) => updateInvoiceLabel(arKey, e.target.value)} />
                <Input label={`${labelText} EN`} value={settings.invoice.labels?.[enKey] || ''} onChange={(e) => updateInvoiceLabel(enKey, e.target.value)} />
              </div>
            ))}
          </div>
        </details>
      </section>
    </SettingsFormShell>
  );
}
