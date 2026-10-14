import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, HandCoins, Scale, Truck, Users, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { hasPermission } from '../adminPermissions';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';

const TYPE_META = {
  collect: { ar: 'تحصيل', en: 'Collected', icon: ArrowDownLeft, tone: 'bg-emerald-50 text-emerald-700' },
  handover: { ar: 'استلام من المندوب', en: 'Handover', icon: ArrowUpRight, tone: 'bg-sky-50 text-sky-700' },
  adjust: { ar: 'تسوية', en: 'Adjustment', icon: Scale, tone: 'bg-amber-50 text-amber-700' },
};

function fmtDateTime(value, isAr) {
  if (!value) return '—';
  return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/** Side panel: one driver's ledger plus "receive cash" and "correct balance" forms. */
function DriverCashPanel({
  driverId, isAr, canWrite, onClose, onChanged,
}) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('handover');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminApi.getDriverCashLedger(driverId)
      .then(({ data: res }) => setData(res.data))
      .catch((err) => toast.error(err.response?.data?.message || err.message));
  }, [driverId, toast]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value) return;
    setSaving(true);
    try {
      const call = mode === 'handover'
        ? adminApi.recordDriverCashHandover(driverId, { amount: value, note })
        : adminApi.adjustDriverCash(driverId, { amount: value, note });
      const { data: res } = await call;
      setData((prev) => ({ ...prev, ...res.data }));
      setAmount('');
      setNote('');
      toast.success(mode === 'handover'
        ? (isAr ? 'تم تسجيل الاستلام' : 'Handover recorded')
        : (isAr ? 'تم تسجيل التسوية' : 'Adjustment recorded'));
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="presentation">
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-cash-title"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="driver-cash-title" className="font-bold">{data?.driver?.name || '…'}</h2>
            <p className="text-sm text-text-muted">{isAr ? 'نقدية المندوب' : 'Driver cash'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-surface" aria-label={isAr ? 'إغلاق' : 'Close'}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {!data ? (
          <div className="flex flex-1 items-center justify-center"><Loader /></div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4 ring-1 ring-violet-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{isAr ? 'النقدية مع المندوب' : 'Cash held'}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatPrice(data.balance)}</p>
            </div>

            {canWrite && (
              <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border p-4">
                <div className="flex gap-1.5 rounded-xl bg-surface p-1">
                  {[
                    ['handover', isAr ? 'استلام نقدية' : 'Receive cash'],
                    ['adjust', isAr ? 'تسوية' : 'Correct balance'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMode(key)}
                      className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${mode === key ? 'bg-white shadow-sm' : 'text-text-muted'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  label={mode === 'handover'
                    ? (isAr ? 'المبلغ المستلم' : 'Amount received')
                    : (isAr ? 'المبلغ (سالب للخصم)' : 'Amount (negative to deduct)')}
                  type="number"
                  step="0.01"
                  min={mode === 'handover' ? '0.01' : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {mode === 'handover' && data.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(data.balance))}
                    className="text-xs font-semibold text-primary-600 hover:underline"
                  >
                    {isAr ? `استلام الكل (${formatPrice(data.balance)})` : `Receive all (${formatPrice(data.balance)})`}
                  </button>
                )}
                <Input
                  label={mode === 'adjust'
                    ? (isAr ? 'السبب (مطلوب)' : 'Reason (required)')
                    : (isAr ? 'ملاحظة (اختياري)' : 'Note (optional)')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !Number(amount) || (mode === 'adjust' && note.trim().length < 3)}
                >
                  <HandCoins className="h-4 w-4" />
                  {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'تسجيل' : 'Record')}
                </Button>
              </form>
            )}

            <div>
              <h3 className="mb-2 text-sm font-bold">{isAr ? 'الحركات' : 'Movements'}</h3>
              {data.entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">{isAr ? 'لا توجد حركات' : 'No movements yet'}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.entries.map((entry) => {
                    const meta = TYPE_META[entry.type] || TYPE_META.adjust;
                    const Icon = meta.icon;
                    return (
                      <li key={entry._id} className="flex items-center gap-3 py-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {isAr ? meta.ar : meta.en}
                            {entry.orderNumber && <span className="ms-1 font-mono text-xs text-text-muted">#{entry.orderNumber}</span>}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {fmtDateTime(entry.createdAt, isAr)}
                            {entry.createdBy ? ` · ${entry.createdBy}` : ''}
                            {entry.note && !entry.orderNumber ? ` · ${entry.note}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-end" dir="ltr">
                          <p className={`text-sm font-bold tabular-nums ${entry.amount > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {entry.amount > 0 ? '+' : '−'}{formatPrice(Math.abs(entry.amount))}
                          </p>
                          <p className="text-[11px] tabular-nums text-text-muted">{formatPrice(entry.balanceAfter)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function DriverCashPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const canWrite = hasPermission(user, 'orders:write');
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    adminApi.getDriverCashBalances()
      .then(({ data }) => {
        setRows(data.data || []);
        setMeta(data.meta || null);
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const holding = (rows || []).filter((r) => r.balance > 0);

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Banknote, label: isAr ? 'إجمالي النقدية مع المناديب' : 'Total cash with drivers', value: formatPrice(meta?.totalHeld || 0), accent: (meta?.totalHeld || 0) > 0 },
          { icon: Users, label: isAr ? 'مناديب معهم نقدية' : 'Drivers holding cash', value: holding.length.toLocaleString() },
          { icon: Truck, label: isAr ? 'كل المناديب' : 'All drivers', value: (rows?.length || 0).toLocaleString() },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-text-muted">
              <card.icon className="h-5 w-5 text-primary-700" />
              <span className="text-sm">{card.label}</span>
            </div>
            <p className={`mt-3 text-2xl font-extrabold tabular-nums ${card.accent ? 'text-amber-600' : ''}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-bold">{isAr ? 'نقدية المناديب' : 'Driver cash balances'}</h2>
          <p className="text-sm text-text-muted">
            {isAr
              ? 'يُضاف المبلغ تلقائياً عند تسليم طلب دفع عند الاستلام. سجّل الاستلام عندما يسلّم المندوب النقدية للفرع.'
              : 'Cash is added automatically when a driver completes a cash-on-delivery order. Record a handover when they pay it in.'}
          </p>
        </div>
        {!rows ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">{isAr ? 'لا يوجد مناديب' : 'No drivers yet'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-surface text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-5 py-3 text-start">{isAr ? 'المندوب' : 'Driver'}</th>
                  <th className="px-5 py-3 text-start">{isAr ? 'النقدية معه' : 'Cash held'}</th>
                  <th className="px-5 py-3 text-start">{isAr ? 'آخر تسليم' : 'Last handover'}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-surface/60">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-xs text-text-muted" dir="ltr">{row.phone || (row.username ? `@${row.username}` : '')}</p>
                    </td>
                    <td className={`px-5 py-3 font-bold tabular-nums ${row.balance > 0 ? 'text-amber-700' : 'text-text-muted'}`}>
                      {formatPrice(row.balance)}
                    </td>
                    <td className="px-5 py-3 text-text-muted">{fmtDateTime(row.lastHandoverAt, isAr)}</td>
                    <td className="px-5 py-3 text-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelected(row._id)}>
                        {canWrite && row.balance > 0 ? (isAr ? 'استلام' : 'Receive') : (isAr ? 'السجل' : 'Ledger')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <DriverCashPanel
          driverId={selected}
          isAr={isAr}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
