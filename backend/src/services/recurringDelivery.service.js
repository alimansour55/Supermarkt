import RecurringDeliverySubscription from '../models/RecurringDeliverySubscription.js';
import User from '../models/User.js';
import {
  addRecurringInterval,
  computeNextRecurringOccurrence,
  startOfDayDate,
} from '../utils/deliveryDate.js';

const WEEKDAY_AR = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
];

const WEEKDAY_EN = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function buildScheduleSummary({
  frequency,
  preferredWeekday,
  preferredDayOfMonth,
  deliveryTimeSlot,
}, lang = 'ar') {
  const isAr = lang === 'ar';
  const slot = isAr ? deliveryTimeSlot?.labelAr : deliveryTimeSlot?.labelEn;
  const slotSuffix = slot ? ` — ${slot}` : '';

  if (frequency === 'monthly') {
    const day = preferredDayOfMonth || 1;
    return isAr ? `كل شهر يوم ${day}${slotSuffix}` : `Monthly on day ${day}${slotSuffix}`;
  }

  const dayName = (isAr ? WEEKDAY_AR : WEEKDAY_EN)[Number(preferredWeekday)] || '';
  if (frequency === 'biweekly') {
    return isAr ? `كل أسبوعين يوم ${dayName}${slotSuffix}` : `Every 2 weeks on ${dayName}${slotSuffix}`;
  }
  return isAr ? `كل أسبوع يوم ${dayName}${slotSuffix}` : `Every week on ${dayName}${slotSuffix}`;
}

function subscriptionSubtotal(sub) {
  return (sub.items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
}

function applyScheduleToSubscription(sub, {
  frequency,
  preferredWeekday,
  preferredDayOfMonth,
  deliveryTimeSlot,
  recalculateNext = true,
}) {
  if (frequency) sub.frequency = frequency;
  if (preferredWeekday !== undefined) sub.preferredWeekday = preferredWeekday;
  if (preferredDayOfMonth !== undefined) sub.preferredDayOfMonth = preferredDayOfMonth;
  if (deliveryTimeSlot) sub.deliveryTimeSlot = deliveryTimeSlot;

  sub.scheduleSummaryAr = buildScheduleSummary(sub, 'ar');
  sub.scheduleSummaryEn = buildScheduleSummary(sub, 'en');

  if (recalculateNext && sub.isActive && !sub.pausedAt) {
    sub.nextDeliveryDate = computeNextRecurringOccurrence({
      frequency: sub.frequency,
      preferredWeekday: sub.preferredWeekday,
      preferredDayOfMonth: sub.preferredDayOfMonth,
    }, new Date());
  }
}

export function formatSubscription(sub, lang = 'ar') {
  const isAr = lang === 'ar';
  const paused = Boolean(sub.pausedAt);
  return {
    _id: sub._id,
    frequency: sub.frequency,
    preferredWeekday: sub.preferredWeekday,
    preferredDayOfMonth: sub.preferredDayOfMonth,
    scheduleSummaryAr: sub.scheduleSummaryAr,
    scheduleSummaryEn: sub.scheduleSummaryEn,
    scheduleSummary: isAr ? sub.scheduleSummaryAr : sub.scheduleSummaryEn,
    startDate: sub.startDate,
    nextDeliveryDate: sub.nextDeliveryDate,
    lastFulfilledAt: sub.lastFulfilledAt,
    deliveriesCount: sub.deliveriesCount || 0,
    deliveryTimeSlot: sub.deliveryTimeSlot,
    deliveryZone: sub.deliveryZone,
    deliveryZoneNameAr: sub.deliveryZoneNameAr,
    deliveryZoneNameEn: sub.deliveryZoneNameEn,
    items: sub.items,
    shippingAddress: sub.shippingAddress,
    phone: sub.phone,
    paymentMethod: sub.paymentMethod,
    notes: sub.notes,
    adminNotes: sub.adminNotes,
    isActive: sub.isActive,
    paused,
    pausedAt: sub.pausedAt,
    cancelledAt: sub.cancelledAt,
    status: !sub.isActive ? 'cancelled' : paused ? 'paused' : 'active',
    subtotal: subscriptionSubtotal(sub),
    sourceOrder: sub.sourceOrder,
    user: sub.user,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
}

export async function createRecurringSubscription({
  userId,
  sourceOrderId,
  items,
  shippingAddress,
  phone,
  deliveryZone,
  deliveryTimeSlot,
  frequency,
  startDate,
  preferredWeekday,
  preferredDayOfMonth,
  paymentMethod,
  notes,
}) {
  const start = new Date(startDate);
  const nextDeliveryDate = addRecurringInterval(start, frequency);
  const scheduleSummaryAr = buildScheduleSummary({
    frequency,
    preferredWeekday,
    preferredDayOfMonth,
    deliveryTimeSlot,
  }, 'ar');
  const scheduleSummaryEn = buildScheduleSummary({
    frequency,
    preferredWeekday,
    preferredDayOfMonth,
    deliveryTimeSlot,
  }, 'en');

  return RecurringDeliverySubscription.create({
    user: userId,
    sourceOrder: sourceOrderId,
    items,
    shippingAddress,
    phone,
    deliveryZone: deliveryZone?._id || null,
    deliveryZoneNameAr: deliveryZone?.nameAr || '',
    deliveryZoneNameEn: deliveryZone?.nameEn || '',
    deliveryTimeSlot,
    frequency,
    preferredWeekday: preferredWeekday ?? null,
    preferredDayOfMonth: preferredDayOfMonth ?? null,
    scheduleSummaryAr,
    scheduleSummaryEn,
    startDate: start,
    nextDeliveryDate,
    paymentMethod: paymentMethod || 'cod',
    notes: notes || '',
    isActive: true,
    pausedAt: null,
    cancelledAt: null,
    lastFulfilledAt: null,
    deliveriesCount: 0,
    adminNotes: '',
  });
}

export async function getSubscriptionsForUser(userId, { includeInactive = false } = {}) {
  const filter = { user: userId };
  if (!includeInactive) {
    filter.isActive = true;
    filter.pausedAt = null;
  }
  return RecurringDeliverySubscription.find(filter)
    .sort({ isActive: -1, nextDeliveryDate: 1 });
}

function buildAdminFilter({ status, frequency, due, search }) {
  const filter = {};

  if (status === 'active') {
    filter.isActive = true;
    filter.pausedAt = null;
  } else if (status === 'paused') {
    filter.isActive = true;
    filter.pausedAt = { $ne: null };
  } else if (status === 'cancelled') {
    filter.isActive = false;
  }

  if (frequency && ['weekly', 'biweekly', 'monthly'].includes(frequency)) {
    filter.frequency = frequency;
  }

  const today = startOfDayDate(new Date());
  if (due === 'today') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    filter.nextDeliveryDate = { $gte: today, $lt: tomorrow };
    filter.isActive = true;
    filter.pausedAt = null;
  } else if (due === 'week') {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    filter.nextDeliveryDate = { $gte: today, $lt: weekEnd };
    filter.isActive = true;
    filter.pausedAt = null;
  } else if (due === 'overdue') {
    filter.nextDeliveryDate = { $lt: today };
    filter.isActive = true;
    filter.pausedAt = null;
  }

  return { filter, search };
}

export async function getAdminSubscriptions({ status, frequency, due, search } = {}) {
  const { filter, search: searchTerm } = buildAdminFilter({ status, frequency, due, search });

  if (searchTerm?.trim()) {
    const regex = new RegExp(searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      $or: [{ name: regex }, { phone: regex }, { email: regex }],
    }).select('_id');
    const userIds = users.map((u) => u._id);
    filter.$or = [
      { phone: regex },
      ...(userIds.length ? [{ user: { $in: userIds } }] : []),
    ];
  }

  return RecurringDeliverySubscription.find(filter)
    .populate('user', 'name phone email')
    .populate('sourceOrder', 'orderNumber')
    .sort({ nextDeliveryDate: 1, createdAt: -1 });
}

export async function getAdminRecurringStats() {
  const today = startOfDayDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [active, paused, cancelled, dueToday, dueWeek, overdue, activeSubs] = await Promise.all([
    RecurringDeliverySubscription.countDocuments({ isActive: true, pausedAt: null }),
    RecurringDeliverySubscription.countDocuments({ isActive: true, pausedAt: { $ne: null } }),
    RecurringDeliverySubscription.countDocuments({ isActive: false }),
    RecurringDeliverySubscription.countDocuments({
      isActive: true,
      pausedAt: null,
      nextDeliveryDate: { $gte: today, $lt: tomorrow },
    }),
    RecurringDeliverySubscription.countDocuments({
      isActive: true,
      pausedAt: null,
      nextDeliveryDate: { $gte: today, $lt: weekEnd },
    }),
    RecurringDeliverySubscription.countDocuments({
      isActive: true,
      pausedAt: null,
      nextDeliveryDate: { $lt: today },
    }),
    RecurringDeliverySubscription.find({ isActive: true, pausedAt: null }).select('items'),
  ]);

  const pipelineValue = activeSubs.reduce((sum, sub) => sum + subscriptionSubtotal(sub), 0);

  return {
    active,
    paused,
    cancelled,
    dueToday,
    dueWeek,
    overdue,
    pipelineValue: Math.round(pipelineValue * 100) / 100,
  };
}

export async function getSubscriptionForUser(userId, subscriptionId) {
  return RecurringDeliverySubscription.findOne({ _id: subscriptionId, user: userId });
}

export async function getSubscriptionById(subscriptionId) {
  return RecurringDeliverySubscription.findById(subscriptionId)
    .populate('user', 'name phone email')
    .populate('sourceOrder', 'orderNumber');
}

function validateScheduleInput({ frequency, preferredWeekday, preferredDayOfMonth }) {
  const freq = frequency || 'weekly';
  if (freq === 'monthly') {
    const day = Number(preferredDayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return { ok: false, message: 'Choose a day of month between 1 and 28' };
    }
  } else {
    const weekday = Number(preferredWeekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, message: 'Choose a recurring weekday' };
    }
  }
  return { ok: true };
}

export async function updateSubscription(userId, subscriptionId, payload = {}) {
  const sub = await RecurringDeliverySubscription.findOne({
    _id: subscriptionId,
    user: userId,
    isActive: true,
  });
  if (!sub) return { error: 'not_found' };

  const {
    frequency,
    preferredWeekday,
    preferredDayOfMonth,
    deliveryTimeSlot,
    notes,
  } = payload;

  const nextFrequency = frequency || sub.frequency;
  const validation = validateScheduleInput({
    frequency: nextFrequency,
    preferredWeekday: preferredWeekday ?? sub.preferredWeekday,
    preferredDayOfMonth: preferredDayOfMonth ?? sub.preferredDayOfMonth,
  });
  if (!validation.ok) return { error: 'validation', message: validation.message };

  applyScheduleToSubscription(sub, {
    frequency: nextFrequency,
    preferredWeekday: nextFrequency === 'monthly' ? null : Number(preferredWeekday ?? sub.preferredWeekday),
    preferredDayOfMonth: nextFrequency === 'monthly'
      ? Number(preferredDayOfMonth ?? sub.preferredDayOfMonth)
      : null,
    deliveryTimeSlot: deliveryTimeSlot || sub.deliveryTimeSlot,
    recalculateNext: !sub.pausedAt,
  });

  if (notes !== undefined) sub.notes = String(notes || '').slice(0, 500);
  await sub.save();
  return { sub };
}

export async function pauseSubscription(userId, subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({ _id: subscriptionId, user: userId, isActive: true });
  if (!sub) return null;
  sub.pausedAt = new Date();
  await sub.save();
  return sub;
}

export async function resumeSubscription(userId, subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({ _id: subscriptionId, user: userId, isActive: true });
  if (!sub) return null;
  sub.pausedAt = null;
  sub.nextDeliveryDate = computeNextRecurringOccurrence({
    frequency: sub.frequency,
    preferredWeekday: sub.preferredWeekday,
    preferredDayOfMonth: sub.preferredDayOfMonth,
  }, new Date());
  await sub.save();
  return sub;
}

export async function cancelSubscription(userId, subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({ _id: subscriptionId, user: userId, isActive: true });
  if (!sub) return null;
  sub.isActive = false;
  sub.cancelledAt = new Date();
  sub.pausedAt = null;
  await sub.save();
  return sub;
}

export async function adminPauseSubscription(subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({ _id: subscriptionId, isActive: true });
  if (!sub) return null;
  sub.pausedAt = new Date();
  await sub.save();
  return sub;
}

export async function adminResumeSubscription(subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({ _id: subscriptionId, isActive: true });
  if (!sub) return null;
  sub.pausedAt = null;
  sub.nextDeliveryDate = computeNextRecurringOccurrence({
    frequency: sub.frequency,
    preferredWeekday: sub.preferredWeekday,
    preferredDayOfMonth: sub.preferredDayOfMonth,
  }, new Date());
  await sub.save();
  return sub;
}

export async function adminCancelSubscription(subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({ _id: subscriptionId, isActive: true });
  if (!sub) return null;
  sub.isActive = false;
  sub.cancelledAt = new Date();
  sub.pausedAt = null;
  await sub.save();
  return sub;
}

export async function adminUpdateSubscription(subscriptionId, payload = {}) {
  const sub = await RecurringDeliverySubscription.findById(subscriptionId);
  if (!sub || !sub.isActive) return { error: 'not_found' };

  const {
    frequency,
    preferredWeekday,
    preferredDayOfMonth,
    deliveryTimeSlot,
    adminNotes,
    notes,
  } = payload;

  if (frequency || preferredWeekday !== undefined || preferredDayOfMonth !== undefined || deliveryTimeSlot) {
    const nextFrequency = frequency || sub.frequency;
    const validation = validateScheduleInput({
      frequency: nextFrequency,
      preferredWeekday: preferredWeekday ?? sub.preferredWeekday,
      preferredDayOfMonth: preferredDayOfMonth ?? sub.preferredDayOfMonth,
    });
    if (!validation.ok) return { error: 'validation', message: validation.message };

    applyScheduleToSubscription(sub, {
      frequency: nextFrequency,
      preferredWeekday: nextFrequency === 'monthly' ? null : Number(preferredWeekday ?? sub.preferredWeekday),
      preferredDayOfMonth: nextFrequency === 'monthly'
        ? Number(preferredDayOfMonth ?? sub.preferredDayOfMonth)
        : null,
      deliveryTimeSlot: deliveryTimeSlot || sub.deliveryTimeSlot,
      recalculateNext: !sub.pausedAt,
    });
  }

  if (adminNotes !== undefined) sub.adminNotes = String(adminNotes || '').slice(0, 1000);
  if (notes !== undefined) sub.notes = String(notes || '').slice(0, 500);
  await sub.save();
  return { sub };
}

export async function advanceSubscriptionDelivery(subscriptionId) {
  const sub = await RecurringDeliverySubscription.findOne({
    _id: subscriptionId,
    isActive: true,
    pausedAt: null,
  });
  if (!sub) return null;

  const fulfilledOn = sub.nextDeliveryDate || new Date();
  sub.lastFulfilledAt = new Date();
  sub.deliveriesCount = (sub.deliveriesCount || 0) + 1;
  sub.nextDeliveryDate = addRecurringInterval(fulfilledOn, sub.frequency);
  await sub.save();
  return sub;
}
