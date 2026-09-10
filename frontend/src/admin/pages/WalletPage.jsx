import { useEffect, useState } from 'react';
import { Save, Wallet, Search, Users, Clock, Check, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';
import { walletTypeLabel, WALLET_TYPE_TONE } from '../../utils/walletHelpers';

const DEFAULT_SETTINGS = {
  enabled: true,
  allowTopUp: true,
  allowCheckoutSpend: true,
  minTopUp: 50,
  maxTopUp: 5000,
  maxBalance: 20000,
  maxCheckoutPercent: 100,
};

function fmtDate(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function HistoryRow({ entry, isAr }) {
  const positive = entry.amount > 0;
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <div className="min-w-0">
        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${WALLET_TYPE_TONE[entry.type] || 'bg-slate-100 text-slate-600'}`}>
          {walletTypeLabel(entry.type, isAr)}
        </span>
        <p className="mt-1 truncate text-xs text-text-muted">
          {entry.orderNumber ? `${isAr ? 'طلب' : 'Order'} #${entry.orderNumber}` : entry.note || '—'}
          <span className="ms-2 text-text-muted/70">{fmtDate(entry.createdAt, isAr)}</span>
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className={`text-sm font-bold tabular-nums ${positive ? 'text-emerald-700' : 'text-red-600'}`} dir="ltr">
          {positive ? '+' : '−'}{formatPrice(Math.abs(entry.amount))}
        </p>
        <p className="text-[11px] text-text-muted tabular-nums" dir="ltr">{formatPrice(entry.balanceAfter)}</p>
      </div>
    </li>
  );
}

export default function WalletPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [topUps, setTopUps] = useState([]);
  const [topUpStatus, setTopUpStatus] = useState('pending');
  const [topUpBusy, setTopUpBusy] = useState('');

  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const loadOverview = () => adminApi.getWalletOverview().then(({ data }) => setOverview(data.data)).catch(() => setOverview(null));
  const loadTopUps = (status = topUpStatus) => adminApi.listWalletTopUps({ status, limit: 30 })
    .then(({ data }) => setTopUps(data.data || []))
    .catch(() => setTopUps([]));

  useEffect(() => {
    Promise.all([
      adminApi.getWalletSettings().then(({ data }) => setSettings({ ...DEFAULT_SETTINGS, ...data.data })),
      loadOverview(),
      loadTopUps('pending'),
    ]).catch(() => toast.error(isAr ? 'تعذر تحميل بيانات المحفظة' : 'Failed to load wallet data'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.updateWalletSettings({
        enabled: !!settings.enabled,
        allowTopUp: !!settings.allowTopUp,
        allowCheckoutSpend: !!settings.allowCheckoutSpend,
        minTopUp: Number(settings.minTopUp) || 0,
        maxTopUp: Number(settings.maxTopUp) || 0,
        maxBalance: Number(settings.maxBalance) || 0,
        maxCheckoutPercent: Number(settings.maxCheckoutPercent) || 0,
      });
      setSettings({ ...DEFAULT_SETTINGS, ...data.data });
      toast.success(isAr ? 'تم حفظ إعدادات المحفظة' : 'Wallet settings saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const changeTopUpStatus = (status) => {
    setTopUpStatus(status);
    loadTopUps(status);
  };

  const approveTopUp = async (id) => {
    setTopUpBusy(id);
    try {
      await adminApi.approveWalletTopUp(id);
      toast.success(isAr ? 'تمت إضافة الرصيد' : 'Wallet credited');
      await Promise.all([loadTopUps(), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الاعتماد' : 'Approval failed'));
    } finally {
      setTopUpBusy('');
    }
  };

  const rejectTopUp = async (id) => {
    const reason = window.prompt(isAr ? 'سبب الرفض (3 أحرف على الأقل)' : 'Rejection reason (3+ characters)');
    if (reason == null) return;
    if (reason.trim().length < 3) {
      toast.error(isAr ? 'سبب غير كافٍ' : 'Reason too short');
      return;
    }
    setTopUpBusy(id);
    try {
      await adminApi.rejectWalletTopUp(id, { note: reason.trim() });
      toast.success(isAr ? 'تم رفض الطلب' : 'Request rejected');
      await Promise.all([loadTopUps(), loadOverview()]);
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الرفض' : 'Rejection failed'));
    } finally {
      setTopUpBusy('');
    }
  };

  const runSearch = async (e) => {
    e?.preventDefault();
    setSearching(true);
    try {
      const { data } = await adminApi.searchWalletUsers(search.trim(), { limit: 12 });
      setUsers(data.data || []);
    } catch {
      toast.error(isAr ? 'تعذر البحث' : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const loadUser = async (userId) => {
    try {
      const { data } = await adminApi.getUserWallet(userId);
      setSelectedUser(data.data.user);
      setHistory(data.data.history || []);
    } catch {
      toast.error(isAr ? 'تعذر تحميل العميل' : 'Failed to load customer');
    }
  };

  const applyAdjust = async () => {
    if (!selectedUser) return;
    const amount = Number(adjustAmount);
    const note = adjustNote.trim();
    if (!amount || note.length < 3) {
      toast.error(isAr ? 'أدخل مبلغاً صحيحاً وسبباً من 3 أحرف' : 'Enter a valid amount and a 3+ character reason');
      return;
    }
    setAdjusting(true);
    try {
      const { data } = await adminApi.adjustUserWallet(selectedUser._id, { amount, note });
      setSelectedUser((prev) => ({ ...prev, walletBalance: data.data.walletBalance }));
      setAdjustAmount('');
      setAdjustNote('');
      await Promise.all([loadUser(selectedUser._id), loadOverview()]);
      toast.success(isAr ? 'تم تعديل الرصيد' : 'Balance adjusted');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر التعديل' : 'Adjustment failed'));
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center"><Loader size="lg" /></div>;
  }

  const numField = (key, label, extra = {}) => (
    <Input label={label} type="number" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} {...extra} />
  );

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Users, label: isAr ? 'عملاء لديهم رصيد' : 'Customers with a balance',
            value: (overview?.customersWithBalance || 0).toLocaleString(),
            sub: `${isAr ? 'من' : 'of'} ${(overview?.customerCount || 0).toLocaleString()}`,
          },
          {
            icon: Wallet, label: isAr ? 'إجمالي الأرصدة' : 'Total balances',
            value: formatPrice(overview?.walletBalance || 0),
            sub: isAr ? 'التزام على المتجر' : 'store liability',
          },
          {
            icon: Clock, label: isAr ? 'طلبات شحن معلقة' : 'Pending top-ups',
            value: (overview?.pendingTopUps || 0).toLocaleString(),
            sub: isAr ? 'بانتظار المراجعة' : 'awaiting review', accent: (overview?.pendingTopUps || 0) > 0,
          },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-muted">
              <card.icon className="h-5 w-5 text-primary-700" />
              <span className="text-sm">{card.label}</span>
            </div>
            <p className={`mt-3 text-2xl font-extrabold ${card.accent ? 'text-amber-600' : ''}`}>{card.value}</p>
            <p className="mt-1 text-xs text-text-muted">{card.sub}</p>
          </article>
        ))}
      </section>

      {/* Settings */}
      <form onSubmit={saveSettings} className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Wallet className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold">{isAr ? 'إعدادات المحفظة' : 'Wallet settings'}</h2>
              <p className="text-sm text-text-muted">{isAr ? 'حدود الشحن والاستخدام عند الدفع' : 'Top-up limits and checkout spending'}</p>
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            ['enabled', isAr ? 'تفعيل المحفظة' : 'Wallet enabled'],
            ['allowTopUp', isAr ? 'السماح بطلبات الشحن' : 'Allow top-up requests'],
            ['allowCheckoutSpend', isAr ? 'السماح بالدفع من المحفظة' : 'Allow paying at checkout'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} className="h-4 w-4 accent-primary-600" />
              {label}
            </label>
          ))}
        </div>

        <fieldset className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {numField('minTopUp', isAr ? 'أقل مبلغ شحن (ج.م)' : 'Min top-up (EGP)', { min: '1' })}
          {numField('maxTopUp', isAr ? 'أعلى مبلغ شحن (ج.م)' : 'Max top-up (EGP)', { min: '1' })}
          {numField('maxBalance', isAr ? 'أقصى رصيد للمحفظة (0 = بلا حد)' : 'Max wallet balance (0 = none)', { min: '0' })}
          {numField('maxCheckoutPercent', isAr ? 'أقصى نسبة من الطلب %' : 'Max % of an order', { min: '0', max: '100' })}
        </fieldset>
      </form>

      {/* Top-up queue */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">{isAr ? 'طلبات شحن المحفظة' : 'Wallet top-up requests'}</h2>
          <div className="flex gap-1.5">
            {['pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => changeTopUpStatus(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${topUpStatus === status ? 'bg-primary-600 text-white' : 'bg-surface text-text'}`}
              >
                {isAr
                  ? { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' }[status]
                  : status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {topUps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
            {isAr ? 'لا توجد طلبات في هذه الحالة.' : 'No requests in this state.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {topUps.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{r.user?.name || '—'} <span className="text-xs font-normal text-text-muted">{r.user?.phone}</span></p>
                    <p className="mt-0.5 text-sm">
                      <span className="font-extrabold tabular-nums text-primary-700" dir="ltr">{formatPrice(r.amount)}</span>
                      {' · '}{isAr ? (r.method === 'instapay' ? 'إنستاباي' : 'فودافون كاش') : r.method}
                      {' · '}{isAr ? 'إلى' : 'to'} <span dir="ltr">{r.destinationAccount}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      {fmtDate(r.createdAt, isAr)}
                      {r.senderReference && ` · ${isAr ? 'من' : 'from'} ${r.senderReference}`}
                    </p>
                    {r.adminNote && <p className="mt-1 text-xs text-text-muted">{isAr ? 'ملاحظة:' : 'Note:'} {r.adminNote}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.proofUrl && (
                      <a href={r.proofUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface">
                        {isAr ? 'صورة التحويل' : 'View proof'}
                      </a>
                    )}
                    {r.status === 'pending' && (
                      <>
                        <Button type="button" size="sm" disabled={topUpBusy === r.id} onClick={() => approveTopUp(r.id)}>
                          <Check className="h-4 w-4" />{isAr ? 'اعتماد' : 'Approve'}
                        </Button>
                        <Button type="button" size="sm" variant="danger" disabled={topUpBusy === r.id} onClick={() => rejectTopUp(r.id)}>
                          <X className="h-4 w-4" />{isAr ? 'رفض' : 'Reject'}
                        </Button>
                      </>
                    )}
                    {r.status !== 'pending' && (
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {isAr ? (r.status === 'approved' ? 'مقبول' : 'مرفوض') : r.status}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Customer wallets */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-bold">{isAr ? 'محافظ العملاء' : 'Customer wallets'}</h2>
        <p className="mb-4 text-xs text-text-muted">
          {isAr
            ? 'ابحث عن عميل لعرض حركته وإضافة أو خصم رصيد (استرداد، تعويض، عرض). كل تعديل يتطلب سبباً موثّقاً.'
            : 'Find a customer to review activity and credit or debit their balance (refund, compensation, promo). Every adjustment needs a documented reason.'}
        </p>
        <form className="flex gap-2" onSubmit={runSearch}>
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
            {users.map((u) => (
              <li key={u._id}>
                <button
                  type="button"
                  onClick={() => loadUser(u._id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start text-sm ${selectedUser?._id === u._id ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-surface'}`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{u.name}</span>
                    <span className="block text-text-muted">{u.phone}</span>
                  </span>
                  <span className="shrink-0 font-bold text-primary-700 tabular-nums" dir="ltr">{formatPrice(u.walletBalance)}</span>
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
                  <span className="block text-2xl font-extrabold text-primary-700 tabular-nums" dir="ltr">{formatPrice(selectedUser.walletBalance)}</span>
                  <span className="block text-[11px] text-text-muted">{isAr ? 'الرصيد' : 'balance'}</span>
                </p>
              </div>

              <div className="mt-4 rounded-lg bg-surface p-3">
                <p className="mb-2 text-xs font-semibold text-text">{isAr ? 'تعديل يدوي (ج.م)' : 'Manual adjustment (EGP)'}</p>
                <div className="space-y-2">
                  <Input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder={isAr ? '+ إضافة / − خصم' : '+ credit / − debit'} />
                  <Input value={adjustNote} maxLength={240} onChange={(e) => setAdjustNote(e.target.value)} placeholder={isAr ? 'السبب (3 أحرف على الأقل)' : 'Reason (3+ chars)'} />
                  <Button type="button" className="w-full" disabled={adjusting || !adjustAmount || adjustNote.trim().length < 3} onClick={applyAdjust}>
                    {adjusting ? '...' : (isAr ? 'تطبيق التعديل' : 'Apply adjustment')}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">{isAr ? 'الرصيد لا يقل عن صفر.' : 'Balance cannot go below zero.'}</p>
              </div>

              <p className="mt-4 mb-1 text-xs font-semibold text-text">{isAr ? 'سجل المحفظة' : 'Wallet history'}</p>
              <ul className="max-h-72 overflow-y-auto pe-1">
                {history.length === 0 && <li className="py-3 text-xs text-text-muted">{isAr ? 'لا توجد حركة.' : 'No activity.'}</li>}
                {history.map((entry) => <HistoryRow key={entry.id} entry={entry} isAr={isAr} />)}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
