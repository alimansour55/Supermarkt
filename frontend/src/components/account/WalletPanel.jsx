import { useState } from 'react';
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Clock, ShieldCheck } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { walletService } from '../../services/apiServices';
import {
  walletTypeLabel,
  walletTopUpStatusLabel,
  WALLET_TYPE_TONE,
} from '../../utils/walletHelpers';
import Button from '../ui/Button';
import Input from '../ui/Input';

function fmtDate(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function HistoryRow({ entry, isAr }) {
  const positive = entry.amount >= 0;
  return (
    <div className="flex items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${WALLET_TYPE_TONE[entry.type] || 'bg-slate-100 text-slate-600'}`}>
          {walletTypeLabel(entry.type, isAr)}
        </span>
        <p className="mt-1 text-xs text-text-muted">
          {entry.orderNumber
            ? `${isAr ? 'طلب' : 'Order'} #${entry.orderNumber}`
            : (entry.note || '')}
          {(entry.orderNumber || entry.note) && ' · '}
          {fmtDate(entry.createdAt, isAr)}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className={`font-bold tabular-nums ${positive ? 'text-emerald-700' : 'text-red-600'}`} dir="ltr">
          {positive ? '+' : '−'}{formatPrice(Math.abs(entry.amount))}
        </p>
        <p className="text-[11px] text-text-muted tabular-nums" dir="ltr">
          {isAr ? 'الرصيد' : 'Bal'} {formatPrice(entry.balanceAfter)}
        </p>
      </div>
    </div>
  );
}

function TopUpForm({ isAr, wallet, onDone }) {
  const settings = wallet?.settings || {};
  const accounts = (wallet?.accounts || []).filter((a) => a.enabled);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(accounts[0]?.id || 'instapay');
  const [account, setAccount] = useState('');
  const [senderReference, setSenderReference] = useState('');
  const [proof, setProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeMethod = accounts.find((a) => a.id === method) || accounts[0] || null;
  const accountNumbers = activeMethod?.accountNumbers || [];
  const min = settings.minTopUp ?? 50;
  const max = settings.maxTopUp ?? 5000;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value < min || value > max) {
      setError(isAr ? `المبلغ من ${min} إلى ${max} ج.م` : `Amount must be between ${min} and ${max} EGP`);
      return;
    }
    if (!account) {
      setError(isAr ? 'اختر الحساب الذي حوّلت إليه' : 'Choose the account you transferred to');
      return;
    }
    if (!proof) {
      setError(isAr ? 'ارفع صورة تأكيد التحويل' : 'Upload a transfer screenshot');
      return;
    }
    setSubmitting(true);
    try {
      await walletService.createTopUp({
        amount: value,
        method: activeMethod.id,
        destinationAccount: account,
        senderReference,
        proofFile: proof,
        lang: isAr ? 'ar' : 'en',
      });
      onDone(true);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر إرسال الطلب' : 'Could not submit the request'));
      setSubmitting(false);
    }
  };

  if (!accounts.length) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {isAr
          ? 'وسائل شحن المحفظة غير مُعدّة بعد — تواصل مع خدمة العملاء.'
          : 'Top-up methods are not configured yet — contact customer support.'}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
      <p className="text-sm font-bold text-text">{isAr ? 'شحن المحفظة' : 'Top up your wallet'}</p>

      <Input
        label={isAr ? `المبلغ (ج.م) — من ${min} إلى ${max}` : `Amount (EGP) — ${min} to ${max}`}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={String(min)}
      />

      <div>
        <p className="mb-1.5 block text-sm font-medium text-text">{isAr ? 'وسيلة التحويل' : 'Transfer method'}</p>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setMethod(a.id); setAccount(''); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                method === a.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-border text-text'
              }`}
            >
              {isAr ? a.labelAr : a.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-medium text-text">{isAr ? 'حوّل إلى أحد هذه الحسابات' : 'Transfer to one of these accounts'}</p>
        <div className="space-y-1.5">
          {accountNumbers.map((a) => (
            <label
              key={a.number}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                account === a.number ? 'border-primary-500 bg-primary-50' : 'border-border'
              }`}
            >
              <span className="min-w-0">
                <span className="block font-bold tabular-nums" dir="ltr">{a.number}</span>
                {(a.labelAr || a.labelEn) && (
                  <span className="block text-xs text-text-muted">{isAr ? a.labelAr : a.labelEn}</span>
                )}
              </span>
              <input
                type="radio"
                name="topup-account"
                checked={account === a.number}
                onChange={() => setAccount(a.number)}
                className="h-4 w-4 accent-primary-600"
              />
            </label>
          ))}
        </div>
      </div>

      <Input
        label={isAr ? 'الرقم الذي حوّلت منه (اختياري)' : 'The number you transferred from (optional)'}
        value={senderReference}
        onChange={(e) => setSenderReference(e.target.value)}
        dir="ltr"
      />

      <div>
        <p className="mb-1.5 block text-sm font-medium text-text">{isAr ? 'صورة تأكيد التحويل' : 'Transfer confirmation screenshot'}</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setProof(e.target.files?.[0] || null)}
          className="block w-full text-sm text-text file:me-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? (isAr ? 'جارٍ الإرسال...' : 'Submitting...') : (isAr ? 'إرسال الطلب' : 'Submit request')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>
      <p className="text-[11px] text-text-muted">
        {isAr
          ? 'يراجع الفريق التحويل ويضيف الرصيد عادةً خلال ساعات العمل.'
          : 'The team verifies the transfer and adds the balance, usually within working hours.'}
      </p>
    </form>
  );
}

export default function WalletPanel({ isAr, wallet, onRefresh, showAllHistory = false }) {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const balance = wallet?.walletBalance ?? 0;
  const settings = wallet?.settings || {};
  const history = showAllHistory ? (wallet?.history || []) : (wallet?.history || []).slice(0, 6);
  const pending = wallet?.pendingTopUps || [];
  const canTopUp = settings.enabled !== false && settings.allowTopUp !== false;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="bg-primary-700 p-6 text-white">
        <p className="flex items-center gap-2 text-sm text-white/80">
          <Wallet className="h-4 w-4" aria-hidden />
          {isAr ? 'رصيد المحفظة' : 'Wallet balance'}
        </p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums" dir="ltr">{formatPrice(balance)}</p>
        {settings.allowCheckoutSpend !== false && balance > 0 && (
          <p className="mt-1 text-sm font-semibold text-emerald-200">
            {isAr ? 'قابل للاستخدام عند الدفع' : 'Usable at checkout'}
          </p>
        )}
        {canTopUp && !topUpOpen && (
          <button
            type="button"
            onClick={() => setTopUpOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {isAr ? 'شحن المحفظة' : 'Top up'}
          </button>
        )}
      </div>

      {topUpOpen && (
        <div className="border-b border-border p-4">
          <TopUpForm
            isAr={isAr}
            wallet={wallet}
            onDone={(submitted) => {
              setTopUpOpen(false);
              if (submitted) onRefresh?.();
            }}
          />
        </div>
      )}

      {pending.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-900">
          <Clock className="me-1.5 inline h-4 w-4" aria-hidden />
          {isAr
            ? `${pending.length} طلب شحن قيد المراجعة (${formatPrice(pending.reduce((s, p) => s + p.amount, 0))})`
            : `${pending.length} top-up request(s) under review (${formatPrice(pending.reduce((s, p) => s + p.amount, 0))})`}
        </div>
      )}

      {settings.enabled !== false && (
        <div className="space-y-1.5 border-b border-border px-5 py-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-text">
            <ArrowDownCircle className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
            {settings.topUpDescription}
          </p>
          <p className="flex items-center gap-2 text-text-muted">
            <ArrowUpCircle className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
            {settings.spendDescription}
          </p>
          <p className="flex items-center gap-2 text-xs text-text-muted/80">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
            {settings.refundDescription}
          </p>
        </div>
      )}

      <div className="px-5 py-2">
        <p className="pt-2 text-xs font-bold text-text">{isAr ? 'سجل المحفظة' : 'Wallet history'}</p>
        <div className="divide-y divide-border">
          {history.map((entry) => <HistoryRow key={entry.id} entry={entry} isAr={isAr} />)}
          {(!wallet?.history || wallet.history.length === 0) && (
            <p className="py-4 text-sm text-text-muted">
              {isAr
                ? 'لا توجد حركة بعد — اشحن محفظتك أو انتظر أول استرداد.'
                : 'No activity yet — top up your wallet or wait for your first refund.'}
            </p>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <p className="mb-2 text-xs font-bold text-text">{isAr ? 'طلبات الشحن' : 'Top-up requests'}</p>
          <ul className="space-y-1.5">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-text-muted">
                  {fmtDate(p.createdAt, isAr)} · {isAr ? (p.method === 'instapay' ? 'إنستاباي' : 'فودافون كاش') : p.method}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums" dir="ltr">{formatPrice(p.amount)}</span>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                    {walletTopUpStatusLabel(p.status, isAr)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
