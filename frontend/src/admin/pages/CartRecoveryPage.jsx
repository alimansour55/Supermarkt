import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Save, ShoppingCart, Play, Plus, Trash2, BellRing, Mail, TicketPercent, TrendingUp, Banknote, Send, Hourglass,
} from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader, Pagination, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';

const MAX_STEPS = 3;

/** Keep in sync with backend DEFAULT_CART_RECOVERY (services/cartRecovery.service.js). */
const DEFAULT_STEP = {
  delayHours: 48,
  push: true,
  email: true,
  coupon: { enabled: true, discountType: 'percent', discountValue: 15, minSubtotal: 0, validDays: 2 },
  titleAr: 'آخر فرصة: خصم {discount} 🎁',
  titleEn: 'Last chance: {discount} off 🎁',
  messageAr: 'سلتك ما زالت بانتظارك. الكود {code} صالح حتى {expiry}.',
  messageEn: 'Your cart is still waiting. Code {code} is valid until {expiry}.',
};

const DEFAULT_SETTINGS = {
  enabled: false,
  minCartValue: 50,
  maxCartAgeDays: 7,
  attributionDays: 7,
  cooldownDays: 3,
  steps: [],
};

const STATUS_META = {
  active: { ar: 'جارية', en: 'In progress', cls: 'bg-amber-50 text-amber-700' },
  recovered: { ar: 'تم الاسترجاع', en: 'Recovered', cls: 'bg-emerald-50 text-emerald-700' },
  expired: { ar: 'انتهت', en: 'Expired', cls: 'bg-slate-100 text-slate-600' },
};

const PREVIEW = { name: 'Mona', count: 3, total: 245, code: 'BACK-7F3A21C9' };

function previewText(template, step, isAr) {
  const c = step.coupon;
  const discount = c.discountType === 'percent'
    ? `${c.discountValue}%`
    : c.discountType === 'fixed'
      ? formatPrice(c.discountValue)
      : (isAr ? 'توصيل مجاني' : 'free delivery');
  const expiry = new Date(Date.now() + c.validDays * 86400000)
    .toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
  const vars = {
    name: PREVIEW.name,
    count: PREVIEW.count,
    total: formatPrice(PREVIEW.total),
    code: c.enabled ? PREVIEW.code : '',
    discount: c.enabled ? discount : '',
    expiry: c.enabled ? expiry : '',
  };
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

function delayLabel(hours, isAr) {
  if (hours >= 24 && hours % 24 === 0) {
    const d = hours / 24;
    return isAr ? `بعد ${d} يوم` : `after ${d} day${d > 1 ? 's' : ''}`;
  }
  return isAr ? `بعد ${hours} ساعة` : `after ${hours}h`;
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 text-text-muted">
        <Icon className="h-5 w-5 text-primary-700" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={`mt-3 text-2xl font-extrabold tabular-nums ${accent ? 'text-emerald-700' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </article>
  );
}

function StepEditor({ step, index, isAr, onChange, onRemove, canRemove, disabled }) {
  const set = (patch) => onChange({ ...step, ...patch });
  const setCoupon = (patch) => onChange({ ...step, coupon: { ...step.coupon, ...patch } });
  const numberField = (value, onValue, extra = {}) => ({
    type: 'number',
    value,
    disabled,
    onChange: (e) => onValue(e.target.value === '' ? '' : Number(e.target.value)),
    ...extra,
  });

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-bold">
          {isAr ? `التذكير ${index + 1}` : `Reminder ${index + 1}`}
          <span className="ms-2 text-xs font-medium text-text-muted">{delayLabel(Number(step.delayHours) || 0, isAr)} {isAr ? 'من آخر نشاط' : 'of inactivity'}</span>
        </p>
        {canRemove && (
          <button type="button" onClick={onRemove} disabled={disabled} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Input label={isAr ? 'الإرسال بعد (ساعات)' : 'Send after (hours)'} {...numberField(step.delayHours, (v) => set({ delayHours: v }), { min: '0.25', step: '0.25' })} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" checked={step.push} disabled={disabled} onChange={(e) => set({ push: e.target.checked })} className="h-4 w-4 accent-primary-600" />
          <BellRing className="h-4 w-4 text-primary-700" />{isAr ? 'إشعار التطبيق' : 'App notification'}
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" checked={step.email} disabled={disabled} onChange={(e) => set({ email: e.target.checked })} className="h-4 w-4 accent-primary-600" />
          <Mail className="h-4 w-4 text-primary-700" />{isAr ? 'بريد إلكتروني' : 'Email'}
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-surface p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={step.coupon.enabled} disabled={disabled} onChange={(e) => setCoupon({ enabled: e.target.checked })} className="h-4 w-4 accent-primary-600" />
          <TicketPercent className="h-4 w-4 text-primary-700" />
          {isAr ? 'إرفاق كوبون خاص بالعميل (استخدام واحد)' : 'Attach a personal single-use coupon'}
        </label>
        {step.coupon.enabled && (
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{isAr ? 'نوع الخصم' : 'Discount type'}</span>
              <select
                value={step.coupon.discountType}
                disabled={disabled}
                onChange={(e) => setCoupon({ discountType: e.target.value })}
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
              >
                <option value="percent">{isAr ? 'نسبة %' : 'Percent %'}</option>
                <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed amount'}</option>
                <option value="free_delivery">{isAr ? 'توصيل مجاني' : 'Free delivery'}</option>
              </select>
            </label>
            {step.coupon.discountType !== 'free_delivery' && (
              <Input label={isAr ? 'القيمة' : 'Value'} {...numberField(step.coupon.discountValue, (v) => setCoupon({ discountValue: v }), { min: '0' })} />
            )}
            <Input label={isAr ? 'حد أدنى للطلب' : 'Min order'} {...numberField(step.coupon.minSubtotal, (v) => setCoupon({ minSubtotal: v }), { min: '0' })} />
            <Input label={isAr ? 'صالح لمدة (أيام)' : 'Valid for (days)'} {...numberField(step.coupon.validDays, (v) => setCoupon({ validDays: v }), { min: '1', max: '30' })} />
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input label={isAr ? 'العنوان (عربي)' : 'Title (Arabic)'} dir="rtl" value={step.titleAr} disabled={disabled} maxLength={120} onChange={(e) => set({ titleAr: e.target.value })} />
        <Input label={isAr ? 'العنوان (إنجليزي)' : 'Title (English)'} dir="ltr" value={step.titleEn} disabled={disabled} maxLength={120} onChange={(e) => set({ titleEn: e.target.value })} />
        <Input label={isAr ? 'الرسالة (عربي)' : 'Message (Arabic)'} dir="rtl" value={step.messageAr} disabled={disabled} maxLength={300} onChange={(e) => set({ messageAr: e.target.value })} />
        <Input label={isAr ? 'الرسالة (إنجليزي)' : 'Message (English)'} dir="ltr" value={step.messageEn} disabled={disabled} maxLength={300} onChange={(e) => set({ messageEn: e.target.value })} />
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{isAr ? 'معاينة' : 'Preview'}</p>
        <p className="font-semibold">{previewText(isAr ? step.titleAr : step.titleEn, step, isAr)}</p>
        <p className="text-text-muted">{previewText(isAr ? step.messageAr : step.messageEn, step, isAr)}</p>
      </div>
    </div>
  );
}

export default function CartRecoveryPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);
  const [episodes, setEpisodes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getCartRecoveryStats({ days });
      setStats(data.data);
    } catch {
      setStats(null);
    }
  }, [days]);

  const loadEpisodes = useCallback(async () => {
    try {
      const { data } = await adminApi.getCartRecoveryEpisodes({ status: statusFilter || undefined, page, limit: 15 });
      setEpisodes(data.data || []);
      setPagination(data.pagination || null);
    } catch {
      setEpisodes([]);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    adminApi.getCartRecoverySettings()
      .then(({ data }) => {
        setSettings(data.data);
        setSaved(data.data);
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل الإعدادات' : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, [isAr, toast]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEpisodes(); }, [loadEpisodes]);

  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  const errors = useMemo(() => {
    const list = [];
    const delays = settings.steps.map((s) => Number(s.delayHours) || 0);
    if (!settings.steps.length) list.push(isAr ? 'أضف تذكيراً واحداً على الأقل' : 'Add at least one reminder');
    if (delays.some((d) => d < 0.25)) list.push(isAr ? 'أقل تأخير 15 دقيقة (0.25 ساعة)' : 'Minimum delay is 15 minutes (0.25h)');
    if (delays.some((d, i) => i > 0 && d <= delays[i - 1])) {
      list.push(isAr ? 'يجب أن يكون كل تذكير بعد السابق' : 'Each reminder must come after the previous one');
    }
    if (settings.steps.some((s) => s.coupon.enabled && s.coupon.discountType === 'percent' && Number(s.coupon.discountValue) > 100)) {
      list.push(isAr ? 'نسبة الخصم لا تتجاوز 100%' : 'Percent discount cannot exceed 100%');
    }
    if (settings.steps.some((s) => !s.push && !s.email)) {
      list.push(isAr ? 'كل تذكير يحتاج قناة إرسال واحدة على الأقل' : 'Every reminder needs at least one channel');
    }
    return list;
  }, [settings, isAr]);

  const updateStep = (index, step) => setSettings((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === index ? step : s)) }));
  const removeStep = (index) => setSettings((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  const addStep = () => setSettings((prev) => {
    const last = prev.steps[prev.steps.length - 1];
    return { ...prev, steps: [...prev.steps, { ...DEFAULT_STEP, delayHours: last ? Number(last.delayHours) * 2 || 48 : 1 }] };
  });

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.updateCartRecoverySettings(settings);
      setSettings(data.data);
      setSaved(data.data);
      toast.success(isAr ? 'تم حفظ إعدادات استرجاع السلة' : 'Cart recovery settings saved');
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const { data } = await adminApi.runCartRecovery();
      const s = data.data;
      toast.success(isAr
        ? `تم فحص ${s.scanned} سلة · أُرسل ${s.sent} تذكير · ${s.recovered} مسترجعة`
        : `Scanned ${s.scanned} carts · sent ${s.sent} reminders · ${s.recovered} recovered`);
      loadStats();
      loadEpisodes();
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر التشغيل' : 'Run failed'));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center"><Loader size="lg" /></div>;
  }

  const general = (key, label, extra = {}) => (
    <Input
      label={label}
      type="number"
      value={settings[key]}
      onChange={(e) => setSettings({ ...settings, [key]: e.target.value === '' ? '' : Number(e.target.value) })}
      min="0"
      {...extra}
    />
  );

  const netGain = (stats?.recoveredRevenue || 0) - (stats?.couponDiscount || 0);

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Results */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">{isAr ? 'النتائج' : 'Results'}</h2>
          <div className="flex rounded-xl border border-border bg-white p-1 text-sm">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 font-medium ${days === d ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-surface'}`}
              >
                {isAr ? `${d} يوم` : `${d} days`}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Banknote}
            label={isAr ? 'إيرادات مسترجعة' : 'Recovered revenue'}
            value={formatPrice(stats?.recoveredRevenue || 0)}
            sub={isAr
              ? `${stats?.recovered || 0} طلب · صافي بعد الكوبونات ${formatPrice(netGain)}`
              : `${stats?.recovered || 0} orders · ${formatPrice(netGain)} net of coupons`}
            accent
          />
          <StatCard
            icon={TrendingUp}
            label={isAr ? 'نسبة الاسترجاع' : 'Recovery rate'}
            value={`${stats?.recoveryRate || 0}%`}
            sub={isAr ? `من ${stats?.episodes || 0} سلة متروكة` : `of ${stats?.episodes || 0} abandoned carts`}
          />
          <StatCard
            icon={Send}
            label={isAr ? 'تذكيرات مرسلة' : 'Reminders sent'}
            value={(stats?.remindersSent || 0).toLocaleString()}
            sub={isAr
              ? `${stats?.recoveredWithCoupon || 0} طلب بكوبون · خصم ${formatPrice(stats?.couponDiscount || 0)}`
              : `${stats?.recoveredWithCoupon || 0} used a coupon · ${formatPrice(stats?.couponDiscount || 0)} discount`}
          />
          <StatCard
            icon={Hourglass}
            label={isAr ? 'سلال متروكة الآن' : 'Abandoned right now'}
            value={formatPrice(stats?.openCarts?.value || 0)}
            sub={isAr
              ? `${stats?.openCarts?.count || 0} سلة لم تكتمل`
              : `in ${stats?.openCarts?.count || 0} idle carts${stats?.openCarts?.capped ? ' (first 1000)' : ''}`}
          />
        </div>

        {stats?.perStep?.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{isAr ? 'التذكير' : 'Reminder'}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'أُرسل' : 'Sent'}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'طلبات بعده' : 'Orders after it'}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'التحويل' : 'Conversion'}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'الإيراد' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody>
                {stats.perStep.map((s) => (
                  <tr key={s.step} className="border-t border-border">
                    <td className="px-4 py-2.5 font-semibold">{isAr ? `التذكير ${s.step + 1}` : `Reminder ${s.step + 1}`}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{s.sent}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{s.recovered}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{s.rate}%</td>
                    <td className="px-4 py-2.5 text-end font-semibold tabular-nums text-emerald-700">{formatPrice(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Settings */}
      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><ShoppingCart className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold">{isAr ? 'تذكيرات السلة المتروكة' : 'Abandoned-cart reminders'}</h2>
              <p className="text-sm text-text-muted">
                {isAr ? 'نذكّر العملاء بالمنتجات التي تركوها في السلة، مع كوبون اختياري.' : 'Remind customers about items left in their cart, with an optional coupon.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isDirty && !saving && <span className="text-xs font-medium text-amber-700">{isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes'}</span>}
            <Button type="button" variant="secondary" onClick={handleRun} disabled={running || isDirty || !saved.enabled} title={!saved.enabled ? (isAr ? 'فعّل الميزة أولاً' : 'Enable the feature first') : undefined}>
              <Play className="h-4 w-4" />
              {running ? '...' : (isAr ? 'تشغيل الآن' : 'Run now')}
            </Button>
            <Button type="submit" disabled={saving || !isDirty || errors.length > 0}>
              <Save className="h-4 w-4" />
              {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="h-4 w-4 accent-primary-600" />
          {isAr ? 'تفعيل التذكيرات التلقائية (تعمل كل 5 دقائق)' : 'Send reminders automatically (checked every 5 minutes)'}
        </label>

        <fieldset className="grid gap-4 md:grid-cols-4">
          {general('minCartValue', isAr ? 'أقل قيمة للسلة (ج.م)' : 'Min cart value (EGP)')}
          {general('maxCartAgeDays', isAr ? 'تجاهل السلال الأقدم من (أيام)' : 'Ignore carts older than (days)', { min: '1', max: '60' })}
          {general('attributionDays', isAr ? 'نافذة احتساب الطلب (أيام)' : 'Attribution window (days)', { min: '1', max: '30' })}
          {general('cooldownDays', isAr ? 'لا تكرار للعميل خلال (أيام)' : 'Per-customer cooldown (days)', { min: '0', max: '60' })}
        </fieldset>

        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-text-muted">
          {isAr
            ? 'المتغيرات المتاحة في النصوص: {name} الاسم · {count} عدد المنتجات · {total} قيمة السلة · {code} الكوبون · {discount} قيمة الخصم · {expiry} تاريخ الانتهاء'
            : 'Placeholders: {name} first name · {count} items · {total} cart value · {code} coupon · {discount} discount · {expiry} coupon expiry'}
        </p>

        <div className="space-y-4">
          {settings.steps.map((step, index) => (
            <StepEditor
              key={index}
              step={step}
              index={index}
              isAr={isAr}
              onChange={(next) => updateStep(index, next)}
              onRemove={() => removeStep(index)}
              canRemove={settings.steps.length > 1}
            />
          ))}
          {settings.steps.length < MAX_STEPS && (
            <Button type="button" variant="secondary" onClick={addStep}>
              <Plus className="h-4 w-4" />{isAr ? 'إضافة تذكير' : 'Add reminder'}
            </Button>
          )}
        </div>

        {errors.length > 0 && (
          <ul className="list-inside list-disc rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((err) => <li key={err}>{err}</li>)}
          </ul>
        )}
      </form>

      {/* Episodes */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">{isAr ? 'السلال المتروكة' : 'Abandoned carts'}</h2>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
            {Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{isAr ? meta.ar : meta.en}</option>)}
          </select>
        </div>

        {episodes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد سلال متروكة بعد. فعّل التذكيرات لتبدأ.' : 'No abandoned carts yet. Turn reminders on to get started.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 text-start font-medium">{isAr ? 'العميل' : 'Customer'}</th>
                  <th className="py-2 text-end font-medium">{isAr ? 'السلة' : 'Cart'}</th>
                  <th className="py-2 text-center font-medium">{isAr ? 'تذكيرات' : 'Reminders'}</th>
                  <th className="py-2 text-start font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-2 text-end font-medium">{isAr ? 'الطلب' : 'Order'}</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((ep) => {
                  const meta = STATUS_META[ep.status] || STATUS_META.active;
                  return (
                    <tr key={ep._id} className="border-b border-border last:border-0">
                      <td className="py-2.5">
                        <p className="font-semibold">{ep.user?.name || '—'}</p>
                        <p className="text-xs text-text-muted" dir="ltr">{ep.user?.phone || ep.user?.email || ''}</p>
                      </td>
                      <td className="py-2.5 text-end tabular-nums">
                        {formatPrice(ep.cartValue)}
                        <span className="block text-xs text-text-muted">{ep.itemCount} {isAr ? 'منتج' : 'items'}</span>
                      </td>
                      <td className="py-2.5 text-center tabular-nums">
                        {ep.stepsSent}
                        {ep.couponCodes?.length > 0 && <span className="block text-[11px] text-text-muted" dir="ltr">{ep.couponCodes.join(', ')}</span>}
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{isAr ? meta.ar : meta.en}</span>
                        <span className="block text-[11px] text-text-muted">
                          {new Date(ep.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      </td>
                      <td className="py-2.5 text-end">
                        {ep.recoveredOrder ? (
                          <Link to={`/admin/orders?order=${ep.recoveredOrder}`} className="font-semibold text-primary-700 hover:underline">
                            #{ep.recoveredOrderNumber || '—'}
                            <span className="block text-xs font-bold text-emerald-700 tabular-nums">{formatPrice(ep.recoveredRevenue)}</span>
                          </Link>
                        ) : <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && (
          <Pagination
            className="mt-4"
            page={pagination.page}
            pages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
            isAr={isAr}
          />
        )}
      </section>
    </div>
  );
}
