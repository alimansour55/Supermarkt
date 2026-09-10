import StoreSettings from '../models/StoreSettings.js';
import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { DEFAULT_WALLET } from '../constants/storeDefaults.js';
import { AppError } from '../utils/AppError.js';

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

export { DEFAULT_WALLET };

export const normalizeWalletSettings = (settings = {}) => {
  const src = settings?.toObject?.({ depopulate: true }) ?? settings ?? {};
  return {
    enabled: src.enabled !== false,
    allowTopUp: src.allowTopUp !== false,
    allowCheckoutSpend: src.allowCheckoutSpend !== false,
    minTopUp: Math.max(1, Number(src.minTopUp ?? DEFAULT_WALLET.minTopUp)),
    maxTopUp: Math.max(1, Number(src.maxTopUp ?? DEFAULT_WALLET.maxTopUp)),
    maxBalance: Math.max(0, Number(src.maxBalance ?? DEFAULT_WALLET.maxBalance)),
    maxCheckoutPercent: Math.min(
      100,
      Math.max(0, Number(src.maxCheckoutPercent ?? DEFAULT_WALLET.maxCheckoutPercent)),
    ),
  };
};

export async function getWalletSettings() {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('wallet').lean();
  return normalizeWalletSettings(settings?.wallet);
}

export function buildWalletSummary(settings, lang = 'ar') {
  const rules = normalizeWalletSettings(settings);
  const isAr = lang === 'ar';
  return {
    ...rules,
    topUpDescription: isAr
      ? `اشحن محفظتك عبر إنستاباي أو فودافون كاش (من ${rules.minTopUp} حتى ${rules.maxTopUp} ج.م) — يراجع الفريق التحويل ويضيف الرصيد.`
      : `Top up by InstaPay or Vodafone Cash (from EGP ${rules.minTopUp} to EGP ${rules.maxTopUp}) — the team verifies the transfer and adds the balance.`,
    spendDescription: rules.allowCheckoutSpend
      ? (isAr
        ? `ادفع من رصيد المحفظة عند إتمام الطلب${rules.maxCheckoutPercent < 100 ? ` (حتى ${rules.maxCheckoutPercent}% من قيمة الطلب)` : ''}.`
        : `Pay with your wallet balance at checkout${rules.maxCheckoutPercent < 100 ? ` (up to ${rules.maxCheckoutPercent}% of the order)` : ''}.`)
      : (isAr ? 'الدفع بالمحفظة عند الشراء غير متاح حالياً.' : 'Paying with the wallet at checkout is currently disabled.'),
    refundDescription: isAr
      ? 'المبالغ المستردة والتعويضات تُضاف إلى محفظتك فوراً.'
      : 'Refunds and store credit land in your wallet instantly.',
  };
}

/**
 * Apply a signed movement to a customer's wallet and record it in the ledger.
 * Credits always succeed; debits fail (return null) when the balance is short.
 */
export async function applyWalletMovement({
  userId,
  amount,
  type,
  method = 'system',
  note = '',
  order = null,
  topUpRequest = null,
  createdBy = null,
}) {
  const delta = roundMoney(amount);
  if (!delta) return null;

  const filter = { _id: userId };
  if (delta < 0) filter.walletBalance = { $gte: Math.abs(delta) };

  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { walletBalance: delta } },
    { new: true },
  ).select('walletBalance');

  if (!user) return null;

  const balanceAfter = roundMoney(user.walletBalance);
  const txn = await WalletTransaction.create({
    user: userId,
    type,
    amount: delta,
    balanceAfter,
    order,
    topUpRequest,
    method,
    note,
    createdBy,
  });

  return { balanceAfter, transaction: txn };
}

export const creditWallet = (opts) => applyWalletMovement({ ...opts, amount: Math.abs(roundMoney(opts.amount)) });
export const debitWallet = (opts) => applyWalletMovement({ ...opts, amount: -Math.abs(roundMoney(opts.amount)) });

/**
 * How much wallet money can actually be applied to an order.
 * `payableTotal` is the order total AFTER coupon + points, BEFORE wallet.
 */
export function calculateWalletRedemption({
  requestedAmount = 0,
  user,
  payableTotal = 0,
  settings,
}) {
  const rules = normalizeWalletSettings(settings);
  const requested = roundMoney(requestedAmount);
  const balance = Math.max(0, roundMoney(user?.walletBalance || 0));
  const total = Math.max(0, roundMoney(payableTotal));

  if (!rules.enabled || !rules.allowCheckoutSpend || requested <= 0 || balance <= 0 || total <= 0) {
    return { walletApplied: 0, rules };
  }

  const percentCap = rules.maxCheckoutPercent > 0
    ? roundMoney(total * (rules.maxCheckoutPercent / 100))
    : total;

  const walletApplied = Math.max(
    0,
    Math.min(requested, balance, total, percentCap),
  );

  return { walletApplied: roundMoney(walletApplied), rules };
}

export async function spendWalletForOrder({ userId, order, walletApplied }) {
  if (!walletApplied || walletApplied <= 0) return null;
  return debitWallet({
    userId,
    amount: walletApplied,
    type: 'spend',
    method: 'order',
    order: order._id,
    note: `Order ${order.orderNumber}`,
  });
}

/** Return wallet money spent on an order after a full cancel / refund. */
export async function reverseOrderWallet(order) {
  if (!order || Number(order.walletAmount || 0) <= 0) return null;
  const amount = roundMoney(order.walletAmount);
  const result = await creditWallet({
    userId: order.user?._id || order.user,
    amount,
    type: 'refund',
    method: 'order',
    order: order._id,
    note: `Wallet refunded — order ${order.orderNumber} cancelled/refunded`,
  });
  order.walletAmount = 0;
  return result;
}

export function assertTopUpAmount(amount, rules) {
  const value = roundMoney(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('Enter a valid top-up amount', 400);
  }
  if (value < rules.minTopUp) {
    throw new AppError(`Minimum top-up is ${rules.minTopUp} EGP`, 400);
  }
  if (value > rules.maxTopUp) {
    throw new AppError(`Maximum top-up is ${rules.maxTopUp} EGP`, 400);
  }
  return value;
}
