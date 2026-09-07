import { useEffect, useState } from 'react';
import { Save, Gift, Search, Plus, Minus, Users, Wallet } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';

const emptyRules = {
  enabled: true,
  earnPointsPerEGP: 0.1,
  redemptionEGPPerPoint: 0.1,
  expiryDays: 365,
  minOrderToEarn: 100,
  minRedeemPoints: 100,
  maxRedeemPercent: 50,
};

export default function LoyaltyPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [rules, setRules] = useState(emptyRules);
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
      adminApi.getLoyaltyRules().then(({ data }) => setRules({ ...emptyRules, ...data.data })),
      loadOverview(),
    ])
      .catch(() => toast.error(isAr ? 'تعذر تحميل بيانات الولاء' : 'Failed to load loyalty data'))
      .finally(() => setLoading(false));
  }, [isAr, toast]);

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
      setRules({ ...emptyRules, ...data.data });
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
      const { data } = await adminApi.adjustUserPoints(selectedUser._id, {
        points,
        note,
      });
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

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-text-muted"><Users className="h-5 w-5 text-primary-700" /><span className="text-sm">{isAr ? 'العملاء المسجلون' : 'Customers'}</span></div>
          <p className="mt-3 text-2xl font-extrabold">{(overview?.customerCount || 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-text-muted">{(overview?.customersWithPoints || 0).toLocaleString()} {isAr ? 'لديهم رصيد نقاط' : 'with a points balance'}</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-text-muted"><Wallet className="h-5 w-5 text-primary-700" /><span className="text-sm">{isAr ? 'إجمالي الرصيد' : 'Points in circulation'}</span></div>
          <p className="mt-3 text-2xl font-extrabold">{(overview?.pointsBalance || 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-text-muted">{isAr ? 'نقطة متاحة للعملاء' : 'points available to customers'}</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-text-muted"><Gift className="h-5 w-5 text-primary-700" /><span className="text-sm">{isAr ? 'حركة آخر 30 يوماً' : 'Last 30 days'}</span></div>
          <p className="mt-3 text-2xl font-extrabold text-emerald-700">+{(overview?.movementLast30Days?.earn?.points || 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-text-muted">{isAr ? 'نقاط مكتسبة' : 'points earned'}</p>
        </article>
      </section>

      <form onSubmit={handleSaveRules} className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">{isAr ? 'قواعد الولاء' : 'Loyalty rules'}</h2>
              <p className="text-sm text-text-muted">{isAr ? 'اكتساب واستبدال النقاط' : 'Earn and redeem settings'}</p>
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rules.enabled} onChange={(e) => setRules({ ...rules, enabled: e.target.checked })} />
          {isAr ? 'تفعيل نقاط الولاء' : 'Enable loyalty points'}
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={isAr ? 'النقاط لكل 1 جنيه' : 'Points per EGP'} type="number" min="0" step="0.01" value={rules.earnPointsPerEGP} onChange={(e) => setRules({ ...rules, earnPointsPerEGP: e.target.value })} />
          <Input label={isAr ? 'قيمة النقطة بالجنيه' : 'EGP per point'} type="number" min="0" step="0.01" value={rules.redemptionEGPPerPoint} onChange={(e) => setRules({ ...rules, redemptionEGPPerPoint: e.target.value })} />
          <Input label={isAr ? 'انتهاء النقاط (أيام)' : 'Expiry days'} type="number" min="0" value={rules.expiryDays} onChange={(e) => setRules({ ...rules, expiryDays: e.target.value })} />
          <Input label={isAr ? 'الحد الأدنى للطلب' : 'Min order to earn'} type="number" min="0" value={rules.minOrderToEarn} onChange={(e) => setRules({ ...rules, minOrderToEarn: e.target.value })} />
          <Input label={isAr ? 'الحد الأدنى للاستبدال' : 'Min redeem points'} type="number" min="0" value={rules.minRedeemPoints} onChange={(e) => setRules({ ...rules, minRedeemPoints: e.target.value })} />
          <Input label={isAr ? 'أقصى نسبة استبدال %' : 'Max redeem %'} type="number" min="0" max="100" value={rules.maxRedeemPercent} onChange={(e) => setRules({ ...rules, maxRedeemPercent: e.target.value })} />
        </div>
      </form>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">{isAr ? 'إدارة نقاط العملاء' : 'Customer points'}</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? 'بحث بالاسم أو الهاتف أو البريد' : 'Search by name, phone, or email'} />
          <Button type="submit" disabled={searching}><Search className="h-4 w-4" />{isAr ? 'بحث' : 'Search'}</Button>
        </form>
        <p className="mt-2 text-xs text-text-muted">{isAr ? 'ابحث عن عميل لعرض نشاطه وتعديل رصيده. يجب توثيق سبب كل تعديل.' : 'Search for a customer to review activity and adjust their balance. Every adjustment requires a reason.'}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <ul className="space-y-2">
            {!searching && users.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
                {isAr ? 'ابدأ بالبحث باسم العميل أو هاتفه أو بريده.' : 'Search by a customer name, phone number, or email to manage points.'}
              </li>
            )}
            {users.map((user) => (
              <li key={user._id}>
                <button type="button" onClick={() => loadUser(user._id)} className={`w-full rounded-xl border px-4 py-3 text-start text-sm ${selectedUser?._id === user._id ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-surface'}`}>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-text-muted">{user.phone} · {user.pointsBalance} {isAr ? 'نقطة' : 'pts'}</p>
                </button>
              </li>
            ))}
          </ul>
          {selectedUser && (
            <div className="rounded-xl border border-border p-4">
              <p className="font-bold">{selectedUser.name}</p>
              <p className="text-2xl font-extrabold text-primary-700 mt-2">{selectedUser.pointsBalance} {isAr ? 'نقطة' : 'points'}</p>
              <p className="mt-4 text-xs text-text-muted">{isAr ? 'استخدم قيمة موجبة للإضافة وسالبة للخصم. لا يمكن أن يقل الرصيد عن صفر.' : 'Use a positive value to add points or a negative value to deduct them. Balances cannot go below zero.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} placeholder={isAr ? '+/- نقاط' : '+/- points'} />
                <Input value={adjustNote} maxLength={240} onChange={(e) => setAdjustNote(e.target.value)} placeholder={isAr ? 'سبب التعديل (3 أحرف على الأقل)' : 'Adjustment reason (3+ characters)'} />
                <Button type="button" disabled={adjusting || !adjustPoints || adjustNote.trim().length < 3} onClick={handleAdjust}>
                  {adjusting ? '...' : (isAr ? 'تطبيق' : 'Apply')}
                </Button>
              </div>
              <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-xs text-text-muted">
                {history.map((entry) => (
                  <li key={entry.id} className="flex justify-between border-b border-border pb-1">
                    <span>{entry.type} · {entry.note || (isAr ? 'بدون ملاحظة' : 'No note')}<br />{entry.createdAt && new Date(entry.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}</span>
                    <span className={entry.points > 0 ? 'text-green-700' : 'text-red-600'}>
                      {entry.points > 0 ? <Plus className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
                      {Math.abs(entry.points)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {pagination?.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-text-muted">{isAr ? `صفحة ${pagination.page} من ${pagination.totalPages} · ${pagination.total} عميل` : `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} customers`}</span>
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
