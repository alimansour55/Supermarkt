import { Link } from '../../app/router';
import { Wallet } from 'lucide-react';
import Button from '../ui/Button';
import { formatPrice } from '../../utils/formatters';
import { calculateMaxWalletSpend } from '../../utils/walletHelpers';

function Shell({ isAr, children }) {
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <Wallet className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-bold text-primary-950">{isAr ? 'المحفظة' : 'Wallet'}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Wallet-balance block on checkout. Visible when the store wallet is on, spending
 * is allowed and the shopper is signed in.
 */
export default function CheckoutWalletApply({
  language,
  isAuthenticated,
  walletEnabled,
  walletBalance = 0,
  walletSettings,
  walletToRedeem,
  onWalletChange,
  walletApplied = 0,
  payableTotal = 0,
}) {
  const isAr = language === 'ar';
  const settings = walletSettings || {};
  const balance = Math.max(0, Number(walletBalance) || 0);
  const maxSpend = calculateMaxWalletSpend({ settings, balance, payableTotal });
  const applied = walletApplied > 0;

  if (!walletEnabled) return null;

  if (!isAuthenticated) {
    return (
      <Shell isAr={isAr}>
        <p className="text-xs text-primary-900">
          {isAr
            ? 'ادفع جزءاً من طلبك من رصيد محفظتك.'
            : 'Pay for part of your order from your wallet balance.'}
        </p>
        <Link to="/login" state={{ from: '/checkout' }} className="mt-2 inline-block text-xs font-bold text-primary-700 hover:underline">
          {isAr ? 'سجّل الدخول لاستخدام المحفظة' : 'Sign in to use your wallet'}
        </Link>
      </Shell>
    );
  }

  if (applied) {
    return (
      <Shell isAr={isAr}>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-primary-100/70 px-3 py-2">
          <span className="text-sm font-semibold text-primary-900">
            {isAr
              ? `تم استخدام ${formatPrice(walletApplied)} من المحفظة`
              : `${formatPrice(walletApplied)} applied from wallet`}
          </span>
          <button type="button" onClick={() => onWalletChange('')} className="shrink-0 text-xs font-bold text-red-600 hover:text-red-700">
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        </div>
      </Shell>
    );
  }

  const balanceLine = (
    <p className="text-xs text-primary-900">
      <span className="font-bold">{isAr ? 'رصيدك:' : 'Your balance:'}</span>{' '}
      <span dir="ltr">{formatPrice(balance)}</span>
    </p>
  );

  if (balance <= 0 || settings.allowCheckoutSpend === false || maxSpend <= 0) {
    return (
      <Shell isAr={isAr}>
        {balanceLine}
        <p className="mt-1 text-xs text-primary-800">
          {balance <= 0
            ? (isAr ? 'محفظتك فارغة — اشحنها لتدفع بها لاحقاً.' : 'Your wallet is empty — top it up to pay with it.')
            : (isAr ? 'لا يمكن استخدام المحفظة على هذا الطلب.' : 'The wallet cannot be used on this order.')}
        </p>
        <Link to="/my-wallet" className="mt-1.5 inline-block text-xs font-bold text-primary-700 hover:underline">
          {isAr ? 'إدارة المحفظة' : 'Manage wallet'}
        </Link>
      </Shell>
    );
  }

  const setDigits = (raw) => {
    const clean = String(raw).replace(/[^\d.]/g, '');
    if (!clean) return onWalletChange('');
    onWalletChange(String(Math.min(Number(clean), maxSpend)));
  };

  return (
    <Shell isAr={isAr}>
      {balanceLine}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={walletToRedeem}
          onChange={(e) => setDigits(e.target.value)}
          placeholder={isAr ? `المبلغ (حتى ${formatPrice(maxSpend)})` : `Amount (up to ${formatPrice(maxSpend)})`}
          className="min-w-0 flex-1 rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onWalletChange(String(Math.min(Number(walletToRedeem) || maxSpend, maxSpend)))}
        >
          {isAr ? 'استخدم' : 'Apply'}
        </Button>
      </div>
      <button type="button" onClick={() => onWalletChange(String(maxSpend))} className="mt-1.5 text-xs font-bold text-primary-700 hover:underline">
        {isAr ? `استخدم كل المتاح: ${formatPrice(maxSpend)}` : `Use max: ${formatPrice(maxSpend)}`}
      </button>
    </Shell>
  );
}
