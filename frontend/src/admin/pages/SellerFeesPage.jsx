import { useEffect, useMemo, useState } from 'react';
import { Link } from '../../app/router';
import { LineChart, Plus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { categoryService } from '../../services/apiServices';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { apiError } from '../../seller/sellerLabels';
import {
  PAYMENT_METHOD_OPTIONS, WEEKDAYS, categoryOptions, feeFormFromSettings, feePayloadFromForm,
} from '../utils/sellerFeesAdmin';
import { NumberField, Section, Toggle, inputCls } from '../components/sellerFees/fields';
import CommissionRulesEditor from '../components/sellerFees/CommissionRulesEditor';
import FeePlansEditor from '../components/sellerFees/FeePlansEditor';
import FeeCalculator from '../components/sellerFees/FeeCalculator';

const NAV = [
  ['standard', 'الرسوم الأساسية', 'Standard fees'],
  ['categories', 'حسب القسم', 'By category'],
  ['rules', 'قواعد وعروض', 'Rules & offers'],
  ['plans', 'الباقات', 'Plans'],
  ['payment', 'الدفع والضريبة', 'Payment & VAT'],
  ['payouts', 'التحويلات', 'Payouts'],
];

const ORDER = [
  ['فترة بدون عمولة للبائع', 'Seller’s commission-free period'],
  ['قاعدة "تتجاوز العقود الخاصة"', 'Rules marked “beats seller deals”'],
  ['عمولة البائع الخاصة (لقسم ثم عامة)', 'The seller’s own rate (per category, then overall)'],
  ['باقي القواعد بالترتيب', 'Other rules, top to bottom'],
  ['عمولة القسم', 'Category rate'],
  ['عمولة الباقة ثم النسبة العامة', 'Plan rate, then the standard rate'],
];

export default function SellerFeesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [categories, setCategories] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getMarketplaceSettings()
      .then(({ data }) => {
        const f = feeFormFromSettings(data.data);
        setForm(f);
        setSaved(JSON.stringify(f));
      })
      .catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load'));
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => {});
    adminApi.listSellers({ limit: 100, sort: 'name', order: 'asc' })
      .then(({ data }) => setSellers((data.data || []).map((s) => ({ value: String(s._id), label: isAr ? s.nameAr : s.nameEn }))))
      .catch(() => {});
  }, [isAr, toast]);

  const catOptions = useMemo(() => categoryOptions(categories, isAr), [categories, isAr]);
  const payload = useMemo(() => (form ? feePayloadFromForm(form) : null), [form]);
  const dirty = form && JSON.stringify(form) !== saved;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!form) return <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setFee = (k) => (v) => setForm((f) => ({ ...f, fees: { ...f.fees, [k]: v } }));
  const setSchedule = (k) => (v) => setForm((f) => ({ ...f, payoutSchedule: { ...f.payoutSchedule, [k]: v } }));
  const setCatRule = (i, patch) => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const setPayFee = (i, patch) => setForm((f) => ({ ...f, fees: { ...f.fees, paymentFees: f.fees.paymentFees.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) } }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await adminApi.updateMarketplaceSettings(payload);
      const f = feeFormFromSettings(data.data);
      setForm(f);
      setSaved(JSON.stringify(f));
      toast.success(isAr ? 'تم الحفظ — تُطبّق على الطلبات الجديدة فقط' : 'Saved — applies to new orders only');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const usedMethods = form.fees.paymentFees.map((f) => f.method);

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        description={isAr
          ? 'كم تأخذ من كل بيعة: عمولة، رسوم ثابتة، باقات شهرية، رسوم الدفع وعروض البائعين. التغييرات تُطبّق على الطلبات الجديدة فقط.'
          : 'What you take on every sale: commission, fixed fees, monthly plans, payment fees and seller offers. Changes apply to new orders only.'}
        action={<Link to="/admin/seller-profit"><Button variant="outline"><LineChart className="h-4 w-4" />{isAr ? 'شاهد أرباحك' : 'See your profit'}</Button></Link>}
      />

      <nav className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-surface/90 px-1 py-2 backdrop-blur" aria-label={isAr ? 'أقسام الصفحة' : 'Page sections'}>
        {NAV.map(([id, ar, en]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-white">{isAr ? ar : en}</a>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Section id="standard" title={isAr ? 'الرسوم الأساسية' : 'Standard fees'} description={isAr ? 'تُطبّق على كل بائع ما لم تغيّرها باقة أو قاعدة أو عقد خاص.' : 'Apply to every seller unless a plan, rule or seller deal changes them.'}>
            <div className="grid gap-4 md:grid-cols-3">
              <NumberField label={isAr ? 'العمولة العامة' : 'Standard commission'} value={form.defaultCommissionRate} onChange={set('defaultCommissionRate')} max={100} suffix="%" hint={isAr ? 'من سعر بيع القطعة' : 'Of the item selling price'} />
              <NumberField label={isAr ? 'أقل عمولة للقطعة' : 'Minimum commission per item'} value={form.fees.minCommissionPerItem} onChange={setFee('minCommissionPerItem')} suffix="EGP" hint={isAr ? '0 = بدون حد أدنى' : '0 = no minimum'} />
              <NumberField label={isAr ? 'أقصى عمولة للقطعة' : 'Commission cap per item'} value={form.fees.maxCommissionPerItem} onChange={setFee('maxCommissionPerItem')} suffix="EGP" hint={isAr ? '0 = بدون حد أقصى' : '0 = no cap'} />
              <NumberField label={isAr ? 'رسوم ثابتة لكل قطعة مباعة' : 'Fixed fee per item sold'} value={form.fees.fixedFeePerItem} onChange={setFee('fixedFeePerItem')} suffix="EGP" hint={isAr ? 'مثل "رسوم الإغلاق" في أمازون' : 'Like Amazon’s closing fee'} />
              <NumberField label={isAr ? 'رسوم ثابتة لكل شحنة' : 'Fixed fee per shipment'} value={form.fees.fixedFeePerShipment} onChange={setFee('fixedFeePerShipment')} suffix="EGP" />
              <NumberField label={isAr ? 'اشتراك شهري' : 'Monthly fee'} value={form.fees.monthlyFee} onChange={setFee('monthlyFee')} step={1} suffix="EGP" hint={isAr ? 'يُخصم أول كل شهر من البائعين النشطين' : 'Charged to active sellers on the 1st'} />
              <NumberField label={isAr ? 'رسوم الشحن من مخزنك / قطعة' : 'Store fulfillment fee / item'} value={form.storeFulfillmentFeePerItem} onChange={set('storeFulfillmentFeePerItem')} suffix="EGP" hint={isAr ? 'عندما يشحن المتجر منتج البائع' : 'When the store ships a seller’s item'} />
              <NumberField label={isAr ? 'رسوم توصيل شحنة البائع' : 'Seller-shipped delivery fee'} value={form.sellerShipmentDeliveryFee} onChange={set('sellerShipmentDeliveryFee')} suffix="EGP" hint={isAr ? 'يدفعها العميل وتذهب للبائع' : 'Paid by the customer, goes to the seller'} />
              <div className="flex items-end">
                <Toggle label={isAr ? 'عمولة على رسوم التوصيل أيضاً' : 'Commission on the delivery fee too'} checked={form.fees.commissionOnDeliveryFee} onChange={setFee('commissionOnDeliveryFee')} />
              </div>
            </div>
          </Section>

          <Section id="categories" title={isAr ? 'العمولة حسب القسم' : 'Commission by category'} description={isAr ? 'نسبة مختلفة لكل قسم — تشمل الأقسام الفرعية. الأدق يكسب.' : 'A different rate per category, including its subcategories. The most specific one wins.'}>
            <div className="space-y-2">
              {form.categoryCommissions.map((r, i) => (
                <div key={i} className="flex max-w-2xl gap-2">
                  <select className={inputCls} value={r.category} onChange={(e) => setCatRule(i, { category: e.target.value })}>
                    <option value="">{isAr ? 'اختر قسماً' : 'Choose a category'}</option>
                    {catOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <span className="relative w-32 shrink-0">
                    <input type="number" min="0" max="100" step="0.5" className={`${inputCls} pr-7`} value={r.rate} onChange={(e) => setCatRule(i, { rate: e.target.value })} dir="ltr" />
                    <span className="pointer-events-none absolute right-3 top-2 text-xs text-text-muted">%</span>
                  </span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: f.categoryCommissions.filter((_, idx) => idx !== i) }))} className="px-2 text-red-600" aria-label={isAr ? 'حذف' : 'Remove'}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((f) => ({ ...f, categoryCommissions: [...f.categoryCommissions, { category: '', rate: '' }] }))} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700"><Plus className="h-4 w-4" />{isAr ? 'إضافة قسم' : 'Add category'}</button>
            </div>
          </Section>

          <Section id="rules" title={isAr ? 'قواعد وعروض العمولة' : 'Commission rules & offers'} description={isAr ? 'أول قاعدة تنطبق على البيعة تحدد نسبتها. استخدمها لعروض البائعين الجدد، شرائح الأسعار، أو حملات لفترة.' : 'The first rule that fits a sale sets its rate. Use them for new-seller offers, price bands or time-limited campaigns.'}>
            <CommissionRulesEditor rules={form.commissionRules} onChange={set('commissionRules')} categories={catOptions} sellers={sellers} plans={form.plans} isAr={isAr} />
            <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">{isAr ? 'كيف تُختار نسبة العمولة؟' : 'How is the rate chosen?'}</summary>
              <ol className="mt-2 list-decimal space-y-0.5 ps-5 text-text-muted">
                {ORDER.map(([ar, en]) => <li key={en}>{isAr ? ar : en}</li>)}
              </ol>
              <p className="mt-2 text-xs text-text-muted">{isAr ? 'بعدها يُطبّق الحد الأدنى والأقصى لكل قطعة. فترة بدون عمولة تعني صفراً تماماً.' : 'Then the per-item minimum and cap apply. A commission-free period means exactly zero.'}</p>
            </details>
          </Section>

          <Section id="plans" title={isAr ? 'باقات البائعين' : 'Seller plans'} description={isAr ? 'اترك أي خانة فارغة لتأخذ القيمة العامة. اختر الباقة لكل بائع من ملفه.' : 'Leave a field empty to use the standard value. Pick each seller’s plan in their profile.'}>
            <FeePlansEditor plans={form.plans} onChange={set('plans')} defaults={form} isAr={isAr} />
          </Section>

          <Section id="payment" title={isAr ? 'رسوم الدفع والضريبة والمرتجعات' : 'Payment fees, VAT & returns'}>
            <p className="mb-2 text-sm font-medium">{isAr ? 'رسوم الدفع على البائع (تُحسب على نصيبه من الطلب)' : 'Payment fees charged to the seller (on its share of the order)'}</p>
            <div className="space-y-2">
              {form.fees.paymentFees.map((r, i) => (
                <div key={i} className="grid max-w-2xl grid-cols-[1fr_7rem_7rem_auto] gap-2">
                  <select className={inputCls} value={r.method} onChange={(e) => setPayFee(i, { method: e.target.value })}>
                    {PAYMENT_METHOD_OPTIONS.filter((m) => m.value === r.method || !usedMethods.includes(m.value)).map((m) => <option key={m.value} value={m.value}>{isAr ? m.ar : m.en}</option>)}
                  </select>
                  <span className="relative"><input type="number" min="0" max="100" step="0.1" className={`${inputCls} pr-7`} value={r.percent} onChange={(e) => setPayFee(i, { percent: e.target.value })} dir="ltr" /><span className="pointer-events-none absolute right-3 top-2 text-xs text-text-muted">%</span></span>
                  <span className="relative"><input type="number" min="0" step="0.5" className={`${inputCls} pr-10`} value={r.fixed} onChange={(e) => setPayFee(i, { fixed: e.target.value })} dir="ltr" /><span className="pointer-events-none absolute right-2 top-2 text-xs text-text-muted">EGP</span></span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, fees: { ...f.fees, paymentFees: f.fees.paymentFees.filter((_, idx) => idx !== i) } }))} className="px-2 text-red-600" aria-label={isAr ? 'حذف' : 'Remove'}>×</button>
                </div>
              ))}
              {usedMethods.length < PAYMENT_METHOD_OPTIONS.length && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, fees: { ...f.fees, paymentFees: [...f.fees.paymentFees, { method: PAYMENT_METHOD_OPTIONS.find((m) => !usedMethods.includes(m.value)).value, percent: '0', fixed: '0' }] } }))} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700"><Plus className="h-4 w-4" />{isAr ? 'رسوم لطريقة دفع' : 'Add payment fee'}</button>
              )}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <NumberField label={isAr ? 'ضريبة القيمة المضافة على رسومك' : 'VAT on your fees'} value={form.fees.vatPercent} onChange={setFee('vatPercent')} max={100} suffix="%" hint={isAr ? 'في مصر 14%. تُضاف على كل الرسوم وتُعرض منفصلة — ليست ربحاً.' : 'Egypt: 14%. Added on top of every fee and shown apart — it is not profit.'} />
              <NumberField label={isAr ? 'رسوم إدارية على المرتجعات' : 'Refund admin fee'} value={form.fees.returnAdminFeePercent} onChange={setFee('returnAdminFeePercent')} max={100} suffix="%" hint={isAr ? 'نسبة من العمولة تحتفظ بها عند الإرجاع (أمازون: 20%). الرسوم الثابتة لا تُرد.' : 'Share of the commission you keep on a return (Amazon keeps 20%). Fixed fees are never refunded.'} />
            </div>
          </Section>

          <Section id="payouts" title={isAr ? 'تحويل أرباح البائعين' : 'Paying sellers'}>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label={isAr ? 'أيام الانتظار بعد التسليم' : 'Hold after delivery (days)'} value={form.payoutHoldDays} onChange={set('payoutHoldDays')} step={1} max={90} hint={isAr ? 'تغطي فترة الإرجاع قبل أن يصبح المبلغ قابلاً للتحويل' : 'Covers the return window before money becomes payable'} />
              <NumberField label={isAr ? 'أقل مبلغ للتحويل' : 'Minimum payout'} value={form.minPayoutAmount} onChange={set('minPayoutAmount')} step={1} suffix="EGP" />
              <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'تحويلات تلقائية' : 'Automatic payouts'}</span>
                <select className={inputCls} value={form.payoutSchedule.frequency} onChange={(e) => setSchedule('frequency')(e.target.value)}>
                  <option value="manual">{isAr ? 'يدوياً فقط' : 'Manual only'}</option>
                  <option value="weekly">{isAr ? 'كل أسبوع' : 'Every week'}</option>
                  <option value="biweekly">{isAr ? 'كل أسبوعين' : 'Every two weeks'}</option>
                  <option value="monthly">{isAr ? 'كل شهر' : 'Every month'}</option>
                </select>
                <span className="mt-1 block text-xs text-text-muted">{isAr ? 'يُنشأ التحويل تلقائياً لكل بائع عنده رصيد وبيانات دفع؛ أنت تحوّل وتؤكّد.' : 'A payout is created for every seller with a balance and payout details; you transfer and confirm.'}</span>
              </label>
              {['weekly', 'biweekly'].includes(form.payoutSchedule.frequency) && (
                <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'يوم التحويل' : 'Payout day'}</span>
                  <select className={inputCls} value={form.payoutSchedule.weekday} onChange={(e) => setSchedule('weekday')(e.target.value)}>
                    {WEEKDAYS.map((d, i) => <option key={d.en} value={i}>{isAr ? d.ar : d.en}</option>)}
                  </select>
                </label>
              )}
              {form.payoutSchedule.frequency === 'monthly' && (
                <NumberField label={isAr ? 'يوم الشهر' : 'Day of the month'} value={form.payoutSchedule.monthDay} onChange={setSchedule('monthDay')} min={1} max={31} step={1} hint={isAr ? '31 = آخر يوم في الشهر' : '31 = the last day of the month'} />
              )}
            </div>
          </Section>
        </div>

        <aside className="xl:sticky xl:top-16 xl:self-start">
          <FeeCalculator settings={payload} sellers={sellers} categories={catOptions} isAr={isAr} />
          <p className="mt-2 px-1 text-xs text-text-muted">{isAr ? 'الحاسبة تستخدم تعديلاتك قبل الحفظ.' : 'The calculator uses your edits before you save.'}</p>
        </aside>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-sm font-medium">{isAr ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes'}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setForm(JSON.parse(saved))}>{isAr ? 'تراجع' : 'Discard'}</Button>
              <Button disabled={saving} onClick={save}>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
