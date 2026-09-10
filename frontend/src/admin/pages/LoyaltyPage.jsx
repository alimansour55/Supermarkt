import { useEffect, useMemo, useState } from 'react';
import { Save, Gift, Search, Users, Wallet, TrendingUp, Coins, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';

/** Keep in sync with backend DEFAULT_LOYALTY (services/loyalty.service.js). */
const DEFAULT_RULES = {
  enabled: true,
  earnPointsPerEGP: 0.1,
  redemptionEGPPerPoint: 0.1,
  expiryDays: 365,
  minOrderToEarn: 0,
  minRedeemPoints: 10,
  maxRedeemPercent: 50,
};

const PREVIEW_ORDER = 200;

function effectiveCashbackPercent(r) {
  const earn = Number(r.earnPointsPerEGP) || 0;
  const value = Number(r.redemptionEGPPerPoint) || 0;
  return Math.round(earn * value * 10000) / 100;
}

const TYPE_META = {
  earn: { ar: 'استرداد نقدي', en: 'Cashback', cls: 'bg-emerald-50 text-emerald-700' },
  redeem: { ar: 'استبدال', en: 'Redeemed', cls: 'bg-blue-50 text-blue-700' },
  refund: { ar: 'استرجاع', en: 'Refund', cls: 'bg-amber-50 text-amber-700' },
  adjust: { ar: 'تعديل يدوي', en: 'Manual adjust', cls: 'bg-violet-50 text-violet-700' },
  expire: { ar: 'انتهاء صلاحية', en: 'Expired', cls: 'bg-slate-100 text-slate-600' },
};

function HistoryRow({ entry, isAr }) {
  const meta = TYPE_META[entry.type] || { ar: entry.type, en: entry.type, cls: 'bg-slate-100 text-slate-600' };
  const positive = entry.points > 0;
  const date = entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <div className="min-w-0">
        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
          {isAr ? meta.ar : meta.en}
        </span>
        <p className="mt-1 truncate text-xs text-text-muted">
          {entry.orderNumber
            ? `${isAr ? 'طلب' : 'Order'} #${entry.orderNumber}`
            : entry.note || '—'}
          {date && <span className="ms-2 text-text-muted/70">{date}</span>}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className={`text-sm font-bold tabular-nums ${positive ? 'text-emerald-700' : 'text-red-600'}`} dir="ltr">
          {positive ? '+' : '−'}{Math.abs(entry.points)}
        </p>
        {entry.cashValue > 0 && (
          <p className="text-[11px] text-text-muted tabular-nums">{formatPrice(entry.cashValue)}</p>
        )}
      </div>
    </li>
  );
}

export default function LoyaltyPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [overview, setOverview] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const loadOverview = async () => {
    try {
      const { data } = await adminApi.getLoyaltyOverview();
      setOverview(data.data);
    } catch {
      setOverview(null);
    }
  };

  useEffect(() => {
    Promise.all([
      adminApi.getLoyaltyRules().then(({ data }) => setRules({ ...DEFAULT_RULES, ...data.data })),
      loadOverview(),
    ])
      .catch(() => toast.error(isAr ? 'تعذر تحميل بيانات الولاء' : 'Failed to load loyalty data'))
      .finally(() => setLoading(false));
  }, [isAr, toast]);

  const preview = useMemo(() => {
    const percent = effectiveCashbackPercent(rules);
    const earn = Number(rules.earnPointsPerEGP) || 0;
    const value = Number(rules.redemptionEGPPerPoint) || 0;
    const points = Math.max(0, Math.floor(PREVIEW_ORDER * earn));
    const pointsPerEgp = value > 0 ? Math.round(1 / value) : 0;
    return { percent, points, cash: Math.round(points * value * 100) / 100, pointsPerEgp };
  }, [rules]);

  const handleSaveRules = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.updateLoyaltyRules({
        ...rules,
        earnPointsPerEGP: Number(rules.earnPointsPerEGP) || 0,
        redemptionEGPPerPoint: Number(rules.redemptionEGPPerPoint) || 0,
        expiryDays: Number(rules.expiryDays) || 0,
        minOrderToEarn: Number(rules.minOrderToEarn) || 0,
        minRedeemPoints: Number(rules.minRedeemPoints) || 0,
        maxRedeemPercent: Number(rules.maxRedeemPercent) || 0,
      });
      setRules({ ...DEFAULT_RULES, ...data.data });
      toast.success(isAr ? 'تم حفظ قواعد الولاء' : 'Loyalty rules saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (page = 1) => {
    setSearching(true);
    try {
      const { data } = await adminApi.searchLoyaltyUsers(search.trim(), { page, limit: 12 });
      setUsers(data.data || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error(isAr ? 'تعذر البحث' : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const loadUser = async (userId) => {
    try {
      const { data } = await adminApi.getUserLoyalty(userId);
      setSelectedUser(data.data.user);
      setHistory(data.data.history || []);
    } catch {
      toast.error(isAr ? 'تعذر تحميل العميل' : 'Failed to load customer');
    }
  };

  const handleAdjust = async () => {
    if (!selectedUser) return;
    const points = Math.trunc(Number(adjustPoints));
    const note = adjustNote.trim();
    if (!points || note.length < 3) {
      toast.error(isAr ? 'أدخل عدد نقاط صحيحاً وسبباً من 3 أحرف على الأقل' : 'Enter a valid point amount and a reason of at least 3 characters');
      return;
    }
    setAdjusting(true);
    try {
      const { data } = await adminApi.adjustUserPoints(selectedUser._id, { points, note });
      setSelectedUser((prev) => ({ ...prev, pointsBalance: data.data.pointsBalance }));
      setAdjustPoints('');
      setAdjustNote('');
      await loadUser(selectedUser._id);
      await loadOverview();
      if (users.length) await handleSearch(pagination?.page || 1);
      toast.success(isAr ? 'تم تعديل النقاط' : 'Points adjusted');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر التعديل' : 'Adjustment failed'));
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center"><Loader size="lg" /></div>;
  }

  const ruleField = (key, label, extra = {}) => (
    <Input
      label={label}
      type="number"
      value={rules[key]}
      onChange={(e) => setRules({ ...rules, [key]: e.target.value })}
      {...extra}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Overview */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Users, label: isAr ? 'العملاء' : 'Customers',
            value: (overview?.customerCount || 0).toLocaleString(),
            sub: `${(overview?.customersWithPoints || 0).toLocaleString()} ${isAr ? 'لديهم رصيد' : 'with a balance'}`,
          },
          {
            icon: Wallet, label: isAr ? 'نقاط متداولة' : 'Points in circulation',
            value: (overview?.pointsBalance || 0).toLocaleString(),
            sub: isAr ? 'إجمالي أرصدة العملاء' : 'total customer balances',
          },
          {
            icon: TrendingUp, label: isAr ? 'آخر 30 يوماً' : 'Last 30 days',
            value: `+${(overview?.movementLast30Days?.earn?.points || 0).toLocaleString()}`,
            sub: isAr ? 'نقاط مكتسبة' : 'points earned', accent: true,
          },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-muted">
              <card.icon className="h-5 w-5 text-primary-700" />
              <span className="text-sm">{card.label}</span>
            </div>
            <p className={`mt-3 text-2xl font-extrabold ${card.accent ? 'text-emerald-700' : ''}`}>{card.value}</p>
            <p className="mt-1 text-xs text-text-muted">{card.sub}</p>
          </article>
        ))}
      </section>

      {/* Rules */}
      <form onSubmit={handleSaveRules} className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Gift className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold">{isAr ? 'قواعد الولاء' : 'Loyalty rules'}</h2>
              <p className="text-sm text-text-muted">{isAr ? 'كيف يكتسب العملاء النقاط ويستبدلونها' : 'How customers earn and redeem points'}</p>
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={rules.enabled} onChange={(e) => setRules({ ...rules, enabled: e.target.checked })} className="h-4 w-4 accent-primary-600" />
          {isAr ? 'تفعيل نقاط الولاء' : 'Loyalty points enabled'}
        </label>

        {/* live preview */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm">
          <p className="font-semibold text-emerald-900">
            {isAr
              ? `العميل يحصل على استرداد ${preview.percent}% — طلب بـ ${formatPrice(PREVIEW_ORDER)} = ${preview.points} نقطة (≈ ${formatPrice(preview.cash)})`
              : `Customers get ${preview.percent}% back — a ${formatPrice(PREVIEW_ORDER)} order earns ${preview.points} points (≈ ${formatPrice(preview.cash)})`}
          </p>
          <p className="mt-1 text-emerald-800">
            {isAr
              ? `الاستبدال: كل ${preview.pointsPerEgp} نقطة = 1 ج.م · حتى ${rules.maxRedeemPercent || 0}% من قيمة الطلب`
              : `Redemption: every ${preview.pointsPerEgp} points = EGP 1 · up to ${rules.maxRedeemPercent || 0}% of an order`}
          </p>
        </div>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-text"><Coins className="h-4 w-4 text-primary-700" />{isAr ? 'الاكتساب' : 'Earning'}</legend>
          {ruleField('earnPointsPerEGP', isAr ? 'نقاط لكل 1 ج.م' : 'Points per EGP spent', { min: '0', step: '0.01' })}
          {ruleField('minOrderToEarn', isAr ? 'الحد الأدنى للطلب لاكتساب النقاط' : 'Min order total to earn', { min: '0' })}
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-3">
          <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-text"><Wallet className="h-4 w-4 text-primary-700" />{isAr ? 'الاستبدال' : 'Redemption'}</legend>
          {ruleField('redemptionEGPPerPoint', isAr ? 'قيمة النقطة الواحدة (ج.م)' : 'EGP value per point', { min: '0', step: '0.01' })}
          {ruleField('minRedeemPoints', isAr ? 'أقل عدد نقاط للاستبدال' : 'Min points to redeem', { min: '0' })}
          {ruleField('maxRedeemPercent', isAr ? 'أقصى نسبة من الطلب %' : 'Max % of an order', { min: '0', max: '100' })}
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-text"><Clock className="h-4 w-4 text-primary-700" />{isAr ? 'الصلاحية' : 'Expiry'}</legend>
          {ruleField('expiryDays', isAr ? 'مدة صلاحية النقاط (أيام، 0 = بلا انتهاء)' : 'Points valid for (days, 0 = never)', { min: '0' })}
        </fieldset>
      </form>

      {/* Customer points */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-bold">{isAr ? 'نقاط العملاء' : 'Customer points'}</h2>
        <p className="mb-4 text-xs text-text-muted">{isAr ? 'ابحث عن عميل لعرض نشاطه وتعديل رصيده. كل تعديل يتطلب سبباً موثّقاً.' : 'Find a customer to review activity and adjust their balance. Every adjustment needs a documented reason.'}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? 'الاسم أو الهاتف أو البريد' : 'Name, phone, or email'} />
          <Button type="submit" disabled={searching}><Search className="h-4 w-4" />{isAr ? 'بحث' : 'Search'}</Button>
        </form>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <ul className="space-y-2">
            {!searching && users.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
                {isAr ? 'ابدأ بالبحث باسم العميل أو هاتفه.' : 'Search by a customer name or phone number.'}
              </li>
            )}
            {users.map((user) => (
              <li key={user._id}>
                <button
                  type="button"
                  onClick={() => loadUser(user._id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start text-sm ${selectedUser?._id === user._id ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-surface'}`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{user.name}</span>
                    <span className="block text-text-muted">{user.phone}</span>
                  </span>
                  <span className="shrink-0 font-bold text-primary-700 tabular-nums">
                    {user.pointsBalance.toLocaleString()} {isAr ? 'نقطة' : 'pts'}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selectedUser && (
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{selectedUser.name}</p>
                  <p className="text-xs text-text-muted">{selectedUser.phone}</p>
                </div>
                <p className="text-end">
                  <span className="block text-2xl font-extrabold text-primary-700 tabular-nums">{selectedUser.pointsBalance.toLocaleString()}</span>
                  <span className="block text-[11px] text-text-muted">{isAr ? 'نقطة' : 'points'}</span>
                </p>
              </div>

              <div className="mt-4 rounded-lg bg-surface p-3">
                <p className="mb-2 text-xs font-semibold text-text">{isAr ? 'تعديل يدوي' : 'Manual adjustment'}</p>
                <div className="space-y-2">
                  <Input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} placeholder={isAr ? '+ إضافة / − خصم' : '+ add / − deduct'} />
                  <Input value={adjustNote} maxLength={240} onChange={(e) => setAdjustNote(e.target.value)} placeholder={isAr ? 'السبب (3 أحرف على الأقل)' : 'Reason (3+ chars)'} />
                  <Button type="button" className="w-full" disabled={adjusting || !adjustPoints || adjustNote.trim().length < 3} onClick={handleAdjust}>
                    {adjusting ? '...' : (isAr ? 'تطبيق التعديل' : 'Apply adjustment')}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">{isAr ? 'الرصيد لا يقل عن صفر.' : 'Balance cannot go below zero.'}</p>
              </div>

              <p className="mt-4 mb-1 text-xs font-semibold text-text">{isAr ? 'سجل النقاط' : 'Points history'}</p>
              <ul className="max-h-72 overflow-y-auto pe-1">
                {history.length === 0 && (
                  <li className="py-3 text-xs text-text-muted">{isAr ? 'لا توجد حركة.' : 'No activity.'}</li>
                )}
                {history.map((entry) => <HistoryRow key={entry.id} entry={entry} isAr={isAr} />)}
              </ul>
            </div>
          )}
        </div>

        {pagination?.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-text-muted">
              {isAr ? `صفحة ${pagination.page} من ${pagination.totalPages}` : `Page ${pagination.page} of ${pagination.totalPages}`}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={searching || pagination.page <= 1} onClick={() => handleSearch(pagination.page - 1)}>{isAr ? 'السابق' : 'Previous'}</Button>
              <Button type="button" variant="secondary" size="sm" disabled={searching || pagination.page >= pagination.totalPages} onClick={() => handleSearch(pagination.page + 1)}>{isAr ? 'التالي' : 'Next'}</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
