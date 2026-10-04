import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { categoryService } from '../../services/apiServices';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { apiError } from '../../seller/sellerLabels';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

function NumberField({ label, hint, value, onChange, min = 0, max, step = 1 }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input type="number" min={min} max={max} step={step} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function MarketplaceSettingsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getMarketplaceSettings()
      .then(({ data }) => {
        const s = data.data;
        setForm({
          ...s,
          categoryCommissions: (s.categoryCommissions || []).map((r) => ({ category: String(r.category), rate: String(r.rate) })),
        });
      })
      .catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load settings'));
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, [isAr, toast]);

  if (!form) return <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setRule = (i, key, value) => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)) }));
  const roots = categories.filter((c) => !c.parentCategory);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateMarketplaceSettings({
        enabled: form.enabled,
        registrationOpen: form.registrationOpen,
        reviewContentEdits: form.reviewContentEdits,
        defaultCommissionRate: Number(form.defaultCommissionRate),
        payoutHoldDays: Number(form.payoutHoldDays),
        storeFulfillmentFeePerItem: Number(form.storeFulfillmentFeePerItem),
        sellerShipmentDeliveryFee: Number(form.sellerShipmentDeliveryFee),
        minPayoutAmount: Number(form.minPayoutAmount),
        categoryCommissions: form.categoryCommissions.filter((r) => r.category && r.rate !== '').map((r) => ({ category: r.category, rate: Number(r.rate) })),
        termsAr: form.termsAr,
        termsEn: form.termsEn,
      });
      toast.success(isAr ? 'تم حفظ إعدادات السوق' : 'Marketplace settings saved');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'إعدادات السوق' : 'Marketplace settings'}
        description={isAr ? 'قواعد البائعين الخارجيين: العمولة، المراجعة، والمدفوعات.' : 'Rules for third-party sellers: commission, review and payouts.'}
        action={<Button disabled={saving} onClick={save}>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}</Button>}
      />

      <section className="grid gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm md:grid-cols-3">
        <Toggle label={isAr ? 'تفعيل السوق' : 'Marketplace enabled'} hint={isAr ? 'عند الإيقاف تتوقف طلبات التسجيل الجديدة' : 'When off, no new seller applications'} checked={form.enabled} onChange={set('enabled')} />
        <Toggle label={isAr ? 'التسجيل مفتوح' : 'Registration open'} hint={isAr ? 'صفحة "بِع معنا" تقبل طلبات جديدة' : '"Sell with us" accepts new applications'} checked={form.registrationOpen} onChange={set('registrationOpen')} />
        <Toggle label={isAr ? 'مراجعة تعديلات المنتجات المعروضة' : 'Review edits to live listings'} hint={isAr ? 'الاسم والوصف والصور تنتظر الاعتماد؛ السعر والمخزون فوراً' : 'Name, description and images wait for approval; price and stock apply at once'} checked={form.reviewContentEdits} onChange={set('reviewContentEdits')} />
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold">{isAr ? 'العمولة والرسوم' : 'Commission & fees'}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField label={isAr ? 'العمولة الافتراضية %' : 'Default commission %'} value={form.defaultCommissionRate} onChange={set('defaultCommissionRate')} max={100} step={0.5} />
          <NumberField label={isAr ? 'رسوم شحن المتجر لكل قطعة (ج.م)' : 'Store fulfillment fee per item (EGP)'} hint={isAr ? 'تُخصم من البائع عندما يشحن المتجر منتجه' : 'Charged to the seller when the store ships its item'} value={form.storeFulfillmentFeePerItem} onChange={set('storeFulfillmentFeePerItem')} step={0.5} />
          <NumberField label={isAr ? 'رسوم توصيل شحنة البائع (ج.م)' : 'Seller-shipped delivery fee (EGP)'} hint={isAr ? 'يدفعها العميل لكل شحنة يشحنها بائع' : 'Paid by the customer per seller-shipped shipment'} value={form.sellerShipmentDeliveryFee} onChange={set('sellerShipmentDeliveryFee')} step={0.5} />
        </div>
        <p className="mb-2 mt-5 text-sm font-medium">{isAr ? 'عمولة حسب القسم (تطبق على القسم وكل أقسامه الفرعية)' : 'Commission by category (applies to the category and all its subcategories)'}</p>
        {form.categoryCommissions.map((r, i) => (
          <div key={i} className="mb-2 flex max-w-xl gap-2">
            <select className={inputCls} value={r.category} onChange={(e) => setRule(i, 'category', e.target.value)}>
              <option value="">{isAr ? 'اختر قسماً' : 'Choose a category'}</option>
              {roots.map((c) => <option key={c._id} value={c._id}>{isAr ? c.nameAr : c.nameEn}</option>)}
            </select>
            <input type="number" min="0" max="100" step="0.5" className={`${inputCls} w-28`} value={r.rate} onChange={(e) => setRule(i, 'rate', e.target.value)} placeholder="%" />
            <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.filter((_, idx) => idx !== i) }))} className="px-2 text-red-600" aria-label={isAr ? 'حذف' : 'Remove'}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: [...f.categoryCommissions, { category: '', rate: '' }] }))} className="text-sm font-semibold text-primary-700">
          + {isAr ? 'إضافة قسم' : 'Add category'}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold">{isAr ? 'المدفوعات' : 'Payouts'}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField label={isAr ? 'فترة الاحتجاز بعد التسليم (أيام)' : 'Hold after delivery (days)'} hint={isAr ? 'تغطي فترة الإرجاع قبل إتاحة الأرباح' : 'Covers the return window before earnings become payable'} value={form.payoutHoldDays} onChange={set('payoutHoldDays')} max={90} />
          <NumberField label={isAr ? 'الحد الأدنى للتحويل (ج.م)' : 'Minimum payout (EGP)'} value={form.minPayoutAmount} onChange={set('minPayoutAmount')} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold">{isAr ? 'شروط البيع' : 'Seller terms'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'بالعربية' : 'Arabic'}</span><textarea rows={8} className={inputCls} value={form.termsAr} onChange={(e) => set('termsAr')(e.target.value)} dir="rtl" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'بالإنجليزية' : 'English'}</span><textarea rows={8} className={inputCls} value={form.termsEn} onChange={(e) => set('termsEn')(e.target.value)} dir="ltr" /></label>
        </div>
      </section>
    </div>
  );
}
