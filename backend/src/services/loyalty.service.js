import StoreSettings from '../models/StoreSettings.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';

/** 1% cashback: earn 0.1 pt per EGP, each point = 0.10 EGP */
export const CASHBACK_PERCENT = 1;

export const DEFAULT_LOYALTY = {
  enabled: true,
  earnPointsPerEGP: 0.1,
  redemptionEGPPerPoint: 0.1,
  expiryDays: 365,
  minOrderToEarn: 0,
  minRedeemPoints: 10,
  maxRedeemPercent: 50,
};

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

export const normalizeLoyaltySettings = (settings = {}) => {
  const legacyMinOrder = settings?.minOrderToEarn === 100;
  const legacyMinRedeem = settings?.minRedeemPoints === 100;

  return {
    ...DEFAULT_LOYALTY,
    ...(settings || {}),
    enabled: settings?.enabled !== false,
    earnPointsPerEGP: Number(settings?.earnPointsPerEGP ?? DEFAULT_LOYALTY.earnPointsPerEGP),
    redemptionEGPPerPoint: Number(settings?.redemptionEGPPerPoint ?? DEFAULT_LOYALTY.redemptionEGPPerPoint),
    minOrderToEarn: legacyMinOrder ? 0 : Number(settings?.minOrderToEarn ?? DEFAULT_LOYALTY.minOrderToEarn),
    minRedeemPoints: legacyMinRedeem ? 10 : Number(settings?.minRedeemPoints ?? DEFAULT_LOYALTY.minRedeemPoints),
  };
};

export function getCashbackPercent(loyalty) {
  const rules = normalizeLoyaltySettings(loyalty);
  return roundMoney(Number(rules.earnPointsPerEGP) * Number(rules.redemptionEGPPerPoint) * 100);
}

export function calculateEarnPointsFromTotal(total, loyalty) {
  const rules = normalizeLoyaltySettings(loyalty);
  if (!rules.enabled) return 0;
  const orderTotal = Number(total || 0);
  if (orderTotal < Number(rules.minOrderToEarn || 0)) return 0;
  return Math.max(0, Math.floor(orderTotal * Number(rules.earnPointsPerEGP || 0)));
}

export function pointsToCashValue(points, loyalty) {
  const rules = normalizeLoyaltySettings(loyalty);
  return roundMoney(Number(points || 0) * Number(rules.redemptionEGPPerPoint || 0));
}

export function buildLoyaltySummary(loyalty, lang = 'ar') {
  const rules = normalizeLoyaltySettings(loyalty);
  const percent = getCashbackPercent(rules);
  const isAr = lang === 'ar';
  return {
    cashbackPercent: percent,
    earnDescription: isAr
      ? `استرداد نقدي ${percent}% على كل طلب — ${rules.earnPointsPerEGP} نقطة لكل جنيه`
      : `${percent}% cashback on every order — ${rules.earnPointsPerEGP} points per EGP`,
    redeemDescription: isAr
      ? `كل نقطة = ${rules.redemptionEGPPerPoint} ج.م · الحد الأدنى للاستبدال ${rules.minRedeemPoints} نقطة`
      : `Each point = ${rules.redemptionEGPPerPoint} EGP · Min redeem ${rules.minRedeemPoints} points`,
  };
}

export async function getLoyaltySettings() {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('loyalty');
  return normalizeLoyaltySettings(settings?.loyalty);
}

export function calculatePointsRedemption({
  requestedPoints = 0,
  user,
  subtotal = 0,
  couponDiscount = 0,
  loyalty,
}) {
  const rules = normalizeLoyaltySettings(loyalty);
  const pointsRequested = Math.max(0, Math.floor(Number(requestedPoints) || 0));
  const balance = Math.max(0, Number(user?.pointsBalance || 0));

  if (!rules.enabled || pointsRequested <= 0) {
    return { pointsRedeemed: 0, pointsDiscount: 0, rules };
  }

  if (rules.redemptionEGPPerPoint <= 0) {
    throw new AppError('Loyalty redemption is not configured', 400);
  }

  if (pointsRequested < rules.minRedeemPoints) {
    throw new AppError(`Minimum redemption is ${rules.minRedeemPoints} points`, 400);
  }

  if (pointsRequested > balance) {
    throw new AppError('You do not have enough points for this redemption', 400);
  }

  const redeemableBase = Math.max(0, Number(subtotal || 0) - Number(couponDiscount || 0));
  const maxDiscount = roundMoney(redeemableBase * (Number(rules.maxRedeemPercent || 0) / 100));
  const requestedDiscount = roundMoney(pointsRequested * Number(rules.redemptionEGPPerPoint || 0));
  const pointsDiscount = Math.min(requestedDiscount, maxDiscount);
  const pointsRedeemed = Math.min(pointsRequested, Math.ceil(pointsDiscount / rules.redemptionEGPPerPoint));

  if (pointsDiscount <= 0 || pointsRedeemed <= 0) {
    return { pointsRedeemed: 0, pointsDiscount: 0, rules };
  }

  return { pointsRedeemed, pointsDiscount, rules };
}

export async function redeemPointsForOrder({ userId, order, pointsRedeemed, pointsDiscount }) {
  if (!pointsRedeemed || pointsRedeemed <= 0) return null;

  return User.findOneAndUpdate(
    { _id: userId, pointsBalance: { $gte: pointsRedeemed } },
    {
      $inc: { pointsBalance: -pointsRedeemed },
      $push: {
        pointsHistory: {
          type: 'redeem',
          points: -pointsRedeemed,
          order: order._id,
          amount: pointsDiscount,
          note: `Redeemed on order ${order.orderNumber}`,
        },
      },
    },
    { new: true },
  );
}

export function canAwardPointsForOrder(order) {
  if (!order || Number(order.pointsEarned || 0) > 0) return false;
  return order.orderStatus === 'delivered' && order.paymentStatus === 'paid';
}

export async function awardPointsForOrder(order) {
  if (!canAwardPointsForOrder(order)) return 0;

  const loyalty = await getLoyaltySettings();
  const points = calculateEarnPointsFromTotal(order.total, loyalty);
  if (points <= 0) return 0;

  const cashValue = pointsToCashValue(points, loyalty);
  const expiresAt = loyalty.expiryDays > 0
    ? new Date(Date.now() + loyalty.expiryDays * 24 * 60 * 60 * 1000)
    : null;

  const awardedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      orderStatus: 'delivered',
      paymentStatus: 'paid',
      pointsEarned: { $lte: 0 },
    },
    { $set: { pointsEarned: points } },
    { new: true },
  );
  if (!awardedOrder) return 0;

  await User.findByIdAndUpdate(awardedOrder.user, {
    $inc: { pointsBalance: points },
    $push: {
      pointsHistory: {
        type: 'earn',
        points,
        order: awardedOrder._id,
        amount: awardedOrder.total,
        note: `Cashback ${getCashbackPercent(loyalty)}% — order ${awardedOrder.orderNumber} (+${cashValue} EGP)`,
        expiresAt,
      },
    },
  });

  order.pointsEarned = points;
  return points;
}
