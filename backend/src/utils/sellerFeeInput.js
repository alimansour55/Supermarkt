/**
 * Validates admin input for the seller fee setup (marketplace fees, plans, commission rules,
 * payout schedule, per-seller deal terms). Throws AppError(400) with a readable message.
 */
import mongoose from 'mongoose';
import { AppError } from './AppError.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v?._id || v || ''));
const idStr = (v) => String(v?._id || v || '');
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

function number(v, { min = 0, max = 1e9, name, nullable = false }) {
  if (nullable && (v === null || v === undefined || v === '')) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new AppError(`${name} must be between ${min} and ${max}`, 400);
  return Math.round(n * 100) / 100;
}

function date(v, name) {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new AppError(`${name} is not a valid date`, 400);
  return d;
}

const bool = (v) => v === true || v === 'true';

export function sanitizeFees(input = {}) {
  const out = {
    minCommissionPerItem: number(input.minCommissionPerItem ?? 0, { name: 'Minimum commission per item' }),
    maxCommissionPerItem: number(input.maxCommissionPerItem ?? 0, { name: 'Commission cap per item' }),
    fixedFeePerItem: number(input.fixedFeePerItem ?? 0, { name: 'Fee per item' }),
    fixedFeePerShipment: number(input.fixedFeePerShipment ?? 0, { name: 'Fee per shipment' }),
    monthlyFee: number(input.monthlyFee ?? 0, { name: 'Monthly fee' }),
    commissionOnDeliveryFee: bool(input.commissionOnDeliveryFee),
    vatPercent: number(input.vatPercent ?? 0, { max: 100, name: 'VAT' }),
    returnAdminFeePercent: number(input.returnAdminFeePercent ?? 0, { max: 100, name: 'Refund admin fee' }),
    paymentFees: [],
  };
  if (out.maxCommissionPerItem && out.minCommissionPerItem > out.maxCommissionPerItem) {
    throw new AppError('The minimum commission per item is above the cap', 400);
  }
  const seen = new Set();
  for (const row of Array.isArray(input.paymentFees) ? input.paymentFees : []) {
    const method = str(row?.method, 40);
    if (!method || seen.has(method)) continue;
    seen.add(method);
    out.paymentFees.push({
      method,
      percent: number(row.percent ?? 0, { max: 100, name: 'Payment fee %' }),
      fixed: number(row.fixed ?? 0, { name: 'Payment fee amount' }),
    });
  }
  return out;
}

const PLAN_NUMBERS = [
  ['commissionRate', 100, 'Plan commission'],
  ['minCommissionPerItem', 1e9, 'Plan minimum commission'],
  ['maxCommissionPerItem', 1e9, 'Plan commission cap'],
  ['fixedFeePerItem', 1e9, 'Plan fee per item'],
  ['fixedFeePerShipment', 1e9, 'Plan fee per shipment'],
  ['storeFulfillmentFeePerItem', 1e9, 'Plan fulfillment fee'],
  ['monthlyFee', 1e9, 'Plan monthly fee'],
  ['payoutHoldDays', 90, 'Plan hold days'],
];

export function sanitizePlans(input) {
  if (!Array.isArray(input)) throw new AppError('plans must be a list', 400);
  const keys = new Set();
  const plans = input.slice(0, 20).map((p, i) => {
    const key = str(p?.key, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || `plan-${i + 1}`;
    if (keys.has(key)) throw new AppError(`Two plans use the key "${key}"`, 400);
    keys.add(key);
    if (!str(p?.nameAr) && !str(p?.nameEn)) throw new AppError('Every plan needs a name', 400);
    const plan = {
      key,
      nameAr: str(p.nameAr, 80),
      nameEn: str(p.nameEn, 80),
      descriptionAr: str(p.descriptionAr, 500),
      descriptionEn: str(p.descriptionEn, 500),
      isDefault: bool(p.isDefault),
    };
    for (const [f, max, name] of PLAN_NUMBERS) plan[f] = number(p[f], { max, name, nullable: true });
    if (plan.payoutHoldDays !== null) plan.payoutHoldDays = Math.round(plan.payoutHoldDays);
    return plan;
  });
  // At most one default — the first one marked wins.
  let found = false;
  for (const p of plans) {
    if (p.isDefault && !found) found = true;
    else p.isDefault = false;
  }
  return plans;
}

export function sanitizeCommissionRules(input, { planKeys = [] } = {}) {
  if (!Array.isArray(input)) throw new AppError('commissionRules must be a list', 400);
  return input.slice(0, 200).map((r, i) => {
    const name = str(r?.name, 80) || `Rule ${i + 1}`;
    const minPrice = number(r.minPrice, { name: `${name}: lowest price`, nullable: true });
    const maxPrice = number(r.maxPrice, { name: `${name}: highest price`, nullable: true });
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new AppError(`${name}: lowest price is above the highest price`, 400);
    const startsAt = date(r.startsAt, `${name}: start`);
    const endsAt = date(r.endsAt, `${name}: end`);
    if (startsAt && endsAt && endsAt <= startsAt) throw new AppError(`${name}: ends before it starts`, 400);
    const newSellerDays = number(r.newSellerDays, { max: 3650, name: `${name}: new-seller days`, nullable: true });
    return {
      ...(isId(r._id) ? { _id: idStr(r._id) } : {}),
      name,
      active: r.active !== false && r.active !== 'false',
      rate: number(r.rate, { max: 100, name: `${name}: commission` }),
      fixedFeePerItem: number(r.fixedFeePerItem, { name: `${name}: fee per item`, nullable: true }),
      overrideSellerDeals: bool(r.overrideSellerDeals),
      categories: [...new Set((r.categories || []).filter(isId).map(idStr))],
      sellers: [...new Set((r.sellers || []).filter(isId).map(idStr))],
      plans: [...new Set((r.plans || []).map((k) => str(k, 40)).filter((k) => planKeys.includes(k)))],
      fulfillment: ['store', 'seller'].includes(r.fulfillment) ? r.fulfillment : 'any',
      minPrice,
      maxPrice,
      startsAt,
      endsAt,
      newSellerDays: newSellerDays ? Math.round(newSellerDays) : null,
    };
  });
}

export function sanitizePayoutSchedule(input = {}) {
  const frequency = ['manual', 'weekly', 'biweekly', 'monthly'].includes(input.frequency) ? input.frequency : 'manual';
  return {
    frequency,
    weekday: Math.round(number(input.weekday ?? 0, { max: 6, name: 'Payout weekday' })),
    monthDay: Math.round(number(input.monthDay ?? 1, { min: 1, max: 31, name: 'Payout day of month' })),
  };
}

const OVERRIDE_NUMBERS = [
  ['minCommissionPerItem', 1e9, 'Minimum commission'],
  ['maxCommissionPerItem', 1e9, 'Commission cap'],
  ['fixedFeePerItem', 1e9, 'Fee per item'],
  ['fixedFeePerShipment', 1e9, 'Fee per shipment'],
  ['storeFulfillmentFeePerItem', 1e9, 'Fulfillment fee'],
  ['monthlyFee', 1e9, 'Monthly fee'],
  ['payoutHoldDays', 90, 'Hold days'],
];

export function sanitizeFeeOverrides(input = {}) {
  const out = {};
  for (const [f, max, name] of OVERRIDE_NUMBERS) out[f] = number(input[f], { max, name, nullable: true });
  if (out.payoutHoldDays !== null) out.payoutHoldDays = Math.round(out.payoutHoldDays);
  out.commissionFreeUntil = date(input.commissionFreeUntil, 'Commission-free date');
  out.vatExempt = bool(input.vatExempt);
  out.payoutFrequency = ['manual', 'weekly', 'biweekly', 'monthly'].includes(input.payoutFrequency) ? input.payoutFrequency : '';
  return out;
}
