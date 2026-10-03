import { AlertTriangle, Banknote, ChevronDown, ChevronUp, CreditCard, Receipt, QrCode, Smartphone, WalletCards } from 'lucide-react';
import Input from '../../components/ui/Input';
import ToggleSwitch from './ToggleSwitch';
import PaymentAccountNumbersEditor from './PaymentAccountNumbersEditor';
import { requiresAccountNumbers } from '../../constants/paymentMethods';

const METHOD_META = {
  paymob_card: {
    title: 'Paymob — Card / Apple Pay',
    Icon: CreditCard,
    iconBg: 'bg-sky-100 text-sky-700',
    accentBorder: 'border-sky-200',
    accentBg: 'bg-sky-50/40',
    hintAr: 'فيزا / ماستركارد / ميزة و Apple Pay عبر صفحة دفع Paymob الآمنة',
    hintEn: 'Visa / Mastercard / Meeza and Apple Pay on Paymob’s secure checkout',
  },
  paymob_wallet: {
    title: 'Paymob — Mobile wallets',
    Icon: Smartphone,
    iconBg: 'bg-sky-100 text-sky-700',
    accentBorder: 'border-sky-200',
    accentBg: 'bg-sky-50/40',
    hintAr: 'فودافون كاش، أورانج، اتصالات، WE Pay — تأكيد تلقائي بدون رفع إيصال',
    hintEn: 'Vodafone Cash, Orange, Etisalat, WE Pay — confirmed automatically, no receipt upload',
  },
  paymob_valu: {
    title: 'Paymob — valU',
    Icon: WalletCards,
    iconBg: 'bg-sky-100 text-sky-700',
    accentBorder: 'border-sky-200',
    accentBg: 'bg-sky-50/40',
    hintAr: 'تقسيط valU عبر Paymob — الاسترداد يتم يدوياً من لوحة valU',
    hintEn: 'valU instalments via Paymob — refunds are handled manually with valU',
  },
  fawry: {
    title: 'Fawry',
    Icon: Receipt,
    iconBg: 'bg-yellow-100 text-yellow-800',
    accentBorder: 'border-yellow-200',
    accentBg: 'bg-yellow-50/40',
    hintAr: 'رقم مرجعي يدفعه العميل في أي منفذ فوري — يتأكد الطلب تلقائياً',
    hintEn: 'Reference number paid at any Fawry outlet — the order confirms automatically',
  },
  stripe: {
    title: 'Stripe',
    Icon: CreditCard,
    iconBg: 'bg-indigo-100 text-indigo-700',
    accentBorder: 'border-indigo-200',
    accentBg: 'bg-indigo-50/40',
    hintAr: 'غير متاح لحسابات التجار في مصر — محفوظ للطلبات القديمة',
    hintEn: 'Not available to Egypt-based merchants — kept for older orders',
  },
  cod: {
    title: 'Cash on Delivery',
    Icon: Banknote,
    iconBg: 'bg-emerald-100 text-emerald-700',
    accentBorder: 'border-emerald-200',
    accentBg: 'bg-emerald-50/40',
    hintAr: 'الدفع نقداً عند استلام الطلب',
    hintEn: 'Customer pays in cash on delivery',
  },
  instapay: {
    title: 'Instapay',
    Icon: QrCode,
    iconBg: 'bg-orange-100 text-orange-700',
    accentBorder: 'border-orange-200',
    accentBg: 'bg-orange-50/40',
    hintAr: 'تحويل عبر Instapay مع رفع صورة الإيصال',
    hintEn: 'Instapay transfer with receipt upload at checkout',
  },
  vodafone_cash: {
    title: 'Vodafone Cash',
    Icon: Smartphone,
    iconBg: 'bg-red-100 text-red-700',
    accentBorder: 'border-red-200',
    accentBg: 'bg-red-50/40',
    hintAr: 'تحويل عبر فودافون كاش مع رفع صورة الإيصال',
    hintEn: 'Vodafone Cash transfer with receipt upload at checkout',
  },
};

function resolveMeta(method) {
  return METHOD_META[method.id] || {
    title: method.id?.toUpperCase?.() || 'Payment',
    Icon: CreditCard,
    iconBg: 'bg-slate-100 text-slate-700',
    accentBorder: 'border-border',
    accentBg: 'bg-slate-50/60',
    hintAr: '',
    hintEn: '',
  };
}

export default function PaymentMethodEditorCard({
  method,
  index,
  total,
  isAr,
  expanded,
  onToggleExpand,
  onUpdate,
  onMoveUp,
  onMoveDown,
}) {
  const enabled = method.enabled !== false;
  const meta = resolveMeta(method);
  const { Icon } = meta;
  const showAccounts = requiresAccountNumbers(method.id);
  const accountCount = method.accountNumbers?.length || 0;

  return (
    <article
      className={[
        'overflow-hidden rounded-2xl border transition-shadow',
        enabled ? meta.accentBorder : 'border-slate-200',
        enabled ? 'shadow-sm' : 'opacity-80',
      ].join(' ')}
    >
      <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-3.5 sm:px-5 ${enabled ? meta.accentBg : 'bg-slate-50/80'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-text">{meta.title}</h3>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600',
              ].join(' ')}
            >
              {enabled ? (isAr ? 'مفعّل' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}
            </span>
            {method.gatewayConfigured === false && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {isAr ? 'غير مُعدّ — مخفي عن العملاء' : 'Not configured — hidden from customers'}
              </span>
            )}
            {showAccounts && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-border">
                {accountCount} {isAr ? 'أرقام' : 'numbers'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{isAr ? meta.hintAr : meta.hintEn}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center rounded-xl border border-border bg-white p-0.5">
            <button
              type="button"
              disabled={index === 0}
              onClick={onMoveUp}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
            >
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={onMoveDown}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <ToggleSwitch
            checked={enabled}
            onChange={(value) => onUpdate('enabled', value)}
            ariaLabel={isAr ? `تفعيل ${meta.title}` : `Enable ${meta.title}`}
          />
        </div>
      </div>

      <div className="space-y-4 bg-white p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-slate-50/60 px-4 py-3 text-start text-sm font-semibold text-text transition hover:bg-slate-50"
        >
          <span>{isAr ? 'تخصيص الاسم والوصف' : 'Customize labels & description'}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {expanded && (
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={isAr ? 'الاسم (عربي)' : 'Label (Arabic)'}
              value={method.labelAr || ''}
              onChange={(e) => onUpdate('labelAr', e.target.value)}
              placeholder={isAr ? 'مثال: دفع أونلاين' : 'e.g. Online payment'}
            />
            <Input
              label={isAr ? 'الاسم (English)' : 'Label (English)'}
              value={method.labelEn || ''}
              onChange={(e) => onUpdate('labelEn', e.target.value)}
              placeholder="Online Payment (Stripe)"
            />
            <Input
              label={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}
              value={method.descriptionAr || ''}
              onChange={(e) => onUpdate('descriptionAr', e.target.value)}
              placeholder={isAr ? 'مثال: فيزا / Mastercard' : 'e.g. Visa / Mastercard'}
            />
            <Input
              label={isAr ? 'الوصف (English)' : 'Description (English)'}
              value={method.descriptionEn || ''}
              onChange={(e) => onUpdate('descriptionEn', e.target.value)}
              placeholder="Visa / Mastercard / Meeza"
            />
          </div>
        )}

        {showAccounts && (
          <PaymentAccountNumbersEditor
            isAr={isAr}
            value={method.accountNumbers || []}
            onChange={(accounts) => onUpdate('accountNumbers', accounts)}
          />
        )}

        {!expanded && !showAccounts && (
          <div className="rounded-xl border border-dashed border-border bg-slate-50/50 px-4 py-3 text-sm">
            <p className="font-semibold text-text">{isAr ? method.labelAr : method.labelEn}</p>
            {(method.descriptionAr || method.descriptionEn) && (
              <p className="mt-1 text-text-muted">{isAr ? method.descriptionAr : method.descriptionEn}</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
