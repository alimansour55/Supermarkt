import Order from '../models/Order.js';
import User from '../models/User.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { resolveProductLine } from '../utils/productCatalog.js';
import {
  syncInventoryReservations,
  commitOrderInventory,
} from '../services/inventoryReservation.service.js';
import { AppError } from '../utils/AppError.js';
import { calculateCartTotals } from '../utils/cartCalculations.js';
import {
  assertCouponRedeemable,
  reserveCouponRedemption,
  releaseCouponRedemption,
} from '../services/coupon.service.js';
import { calculateItemsSubtotal, calculatePromotedLineTotal } from '../utils/cartLinePricing.js';
import { createShipmentsForOrder } from '../services/marketplaceOrder.service.js';
import { formatOrder } from '../utils/formatters.js';
import { notifyOrderCreated, notifyOrderStatusChange } from '../utils/sendEmail.js';
import { notifyOrderTimeline } from '../services/orderNotification.service.js';
import {
  notifyCustomerOrderStatus,
  notifyCustomerDriverAssigned,
  notifyCustomerTrackingLive,
} from '../services/orderTrackingNotify.service.js';
import { autoAssignDriverToOrder } from '../services/deliveryDispatch.service.js';
import { pushStatusHistory } from '../services/orderManagement.service.js';
import { ORDER_STATUS_VALUES } from '../constants/orderStatuses.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import {
  applyDeliveryFailureReason,
  clearDeliveryFailureReason,
  getDeliveryFailureReasonForLang,
} from '../constants/deliveryFailureReasons.js';
import { canShowOrderTracking } from '../services/deliveryTracking.service.js';
import { getGpsDeliveryEnabled } from '../services/storeSettings.service.js';
import { formatOrderResponse } from '../controllers/orderManagement.controller.js';
import {
  countUnreadCustomerMessages,
  formatOrderChatListItem,
  markOrderMessagesReadByAdmin,
} from '../utils/orderMessages.js';
import { persistOrderDeliveredAtIfNeeded } from '../services/orderReturn.service.js';
import { logAudit } from '../services/auditLog.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import {
  awardPointsForOrder,
  redeemPointsForOrder,
} from '../services/loyalty.service.js';
import { spendWalletForOrder, creditWallet } from '../services/wallet.service.js';
import {
  findDeliveryZone,
  listPublicDeliveryZones,
  validateDeliveryForZone,
} from '../services/deliveryZone.service.js';
import { anyZoneHasCoords, findCoveringZone, haversineKm } from '../utils/zoneCoverage.js';
import { resolveFulfillmentLocationForZone } from '../services/fulfillmentLocation.service.js';
import { enrichAndValidateAddress } from '../services/addressEnrichment.service.js';
import {
  completeOrderTracking,
  ensureOrderTracking,
} from '../services/deliveryTracking.service.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { resolveRequestLang } from '../utils/stockMessages.js';
import { assertDeliveryDateInWindow } from '../utils/deliveryDate.js';
import {
  assertDeliverySlotAvailable,
  getEffectiveSlotStart,
  isExpressAvailableNow,
} from '../utils/deliverySlotAvailability.js';
import { resolveDeliveryLeadMinutes } from '../utils/deliveryLeadTime.js';
import StoreSettings from '../models/StoreSettings.js';
import {
  isOnlinePaymentMethod,
  isValidPaymentMethod,
  normalizePaymentMethodId,
  requiresPaymentProof,
} from '../constants/paymentMethods.js';
import { isPaymentMethodConfigured } from '../config/payments.js';
import {
  CLOUDINARY_FOLDERS,
  uploadFileToCloudinary,
} from '../utils/cloudinaryUpload.js';
import {
  createRecurringSubscription,
  getSubscriptionsForUser,
  getAdminSubscriptions,
  getAdminRecurringStats as fetchAdminRecurringStats,
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  updateSubscription,
  adminPauseSubscription,
  adminResumeSubscription,
  adminCancelSubscription,
  adminUpdateSubscription,
  advanceSubscriptionDelivery,
  formatSubscription,
} from '../services/recurringDelivery.service.js';

export const ADMIN_ORDER_SORT = ['createdAt', 'total', 'orderNumber'];

/** Orders in the recycle bin (either stage) are hidden from the regular admin list/export. */
const NOT_TRASHED = { 'trash.stage': { $nin: ['bin1', 'bin2'] } };

export function buildAdminOrderFilter(query) {
  const filter = {};
  if (query.orderStatus) {
    // `confirmed` is a legacy alias of `preparing` (see orderStatuses.js) — keep
    // the "Preparing" filter matching both so old orders don't disappear.
    filter.orderStatus = query.orderStatus === 'preparing'
      ? { $in: ['preparing', 'confirmed'] }
      : query.orderStatus;
  }
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (query.q) {
    const rx = { $regex: escapeRegex(String(query.q).trim()), $options: 'i' };
    filter.$or = [
      { orderNumber: rx },
      { phone: rx },
      { couponCode: rx },
    ];
  }

  return filter;
}

export const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    shippingAddress,
    phone,
    alternatePhone,
    notes,
    paymentMethod: rawPaymentMethod = 'cod',
    manualPaymentAccount: rawManualPaymentAccount,
    deliveryMethod = 'scheduled',
    scheduledDate,
    recurringFrequency,
    recurringPreferredWeekday,
    recurringPreferredDayOfMonth,
    discountCode,
    pointsToRedeem = 0,
    walletToRedeem = 0,
    deliveryZoneId,
    timeSlotId,
    area,
  } = req.body;

  if (!items?.length) {
    throw new AppError('Cart is empty', 400);
  }

  if (!shippingAddress?.street) {
    throw new AppError('Delivery address is required', 400);
  }

  if (!phone) {
    throw new AppError('Phone number is required', 400);
  }

  const lang = resolveRequestLang(req.body);
  const paymentMethod = normalizePaymentMethodId(rawPaymentMethod);
  if (!isValidPaymentMethod(paymentMethod)) {
    throw new AppError(lang === 'ar' ? 'طريقة الدفع غير صالحة' : 'Invalid payment method', 400);
  }

  const storeSettings = await StoreSettings.findOne({ key: 'main' }).lean();
  const enabledPaymentMethods = (storeSettings?.paymentMethods || [])
    .filter((method) => method.enabled !== false)
    .map((method) => method.id);

  if (enabledPaymentMethods.length && !enabledPaymentMethods.includes(paymentMethod)) {
    throw new AppError(lang === 'ar' ? 'طريقة الدفع غير متاحة حالياً' : 'Payment method is not available', 400);
  }

  if (!isPaymentMethodConfigured(paymentMethod)) {
    throw new AppError(lang === 'ar' ? 'طريقة الدفع غير متاحة حالياً' : 'Payment method is not available', 400);
  }

  let manualPaymentAccount = String(rawManualPaymentAccount || '').trim();
  let paymentProofUrl = '';
  let paymentProofPublicId = '';
  let paymentProofUploadedAt = null;

  if (requiresPaymentProof(paymentMethod)) {
    const methodConfig = (storeSettings?.paymentMethods || []).find((method) => method.id === paymentMethod);
    const accountNumbers = methodConfig?.accountNumbers || [];
    if (!accountNumbers.length) {
      throw new AppError(
        lang === 'ar' ? 'طريقة الدفع غير مُعدّة بعد — تواصل مع المتجر' : 'Payment method is not configured yet',
        400,
      );
    }
    if (!manualPaymentAccount) {
      throw new AppError(lang === 'ar' ? 'اختر رقم التحويل الذي دفعت إليه' : 'Select the account number you paid to', 400);
    }
    if (!accountNumbers.some((entry) => entry.number === manualPaymentAccount)) {
      throw new AppError(lang === 'ar' ? 'رقم التحويل غير صالح' : 'Invalid transfer account number', 400);
    }
    if (!req.file?.buffer?.length) {
      throw new AppError(lang === 'ar' ? 'ارفع صورة تأكيد التحويل' : 'Upload a transfer confirmation screenshot', 400);
    }
    const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.paymentProofs);
    paymentProofUrl = uploaded.url;
    paymentProofPublicId = uploaded.publicId;
    paymentProofUploadedAt = new Date();
  }

  const normalizedAlternatePhone = String(alternatePhone || '').trim();
  if (normalizedAlternatePhone && normalizedAlternatePhone === String(phone).trim()) {
    throw new AppError(
      resolveRequestLang(req.body) === 'ar'
        ? 'رقم الهاتف البديل يجب أن يكون مختلفاً عن الرقم الأساسي'
        : 'Alternate phone must be different from the primary number',
      400,
    );
  }

  const subtotal = calculateItemsSubtotal(items);

  if (discountCode) {
    // Read-only preflight — throws a customer-facing AppError on expiry / min-order /
    // usage-limit / per-customer-limit. The redemption slot is claimed atomically
    // later (reserveCouponRedemption), just before the order is persisted.
    await assertCouponRedeemable({
      code: discountCode,
      userId: req.user._id,
      subtotal,
      lang,
    });
  }

  const deliveryZone = await findDeliveryZone(deliveryZoneId || area);
  const fulfillmentLocation = await resolveFulfillmentLocationForZone(deliveryZone._id || deliveryZone.id);

  const enrichedShipping = await enrichAndValidateAddress(
    {
      ...shippingAddress,
      street: shippingAddress.street,
      area: shippingAddress.area || area,
      city: shippingAddress.city || area,
    },
    {
      deliveryZoneId: deliveryZone._id || deliveryZone.id,
      lang,
    },
  );

  validateDeliveryForZone({
    zone: deliveryZone,
    deliveryMethod,
    subtotal,
    timeSlotId,
  });

  // Customer's chosen pin (from the startup location popup or the checkout map).
  // Kept even when the checkout map feature is off, so admin/driver still see it.
  const rawPinLat = Number(shippingAddress?.lat);
  const rawPinLng = Number(shippingAddress?.lng);
  const hasCustomerPin = Number.isFinite(rawPinLat) && Number.isFinite(rawPinLng);
  const customerPinLat = enrichedShipping.lat ?? (hasCustomerPin ? rawPinLat : null);
  const customerPinLng = enrichedShipping.lng ?? (hasCustomerPin ? rawPinLng : null);

  // Delivery-area coverage. The coverage areas (the umbrella — one or more independent
  // circles) are the hard boundary when configured — they always win over any single zone's
  // radius. Delivery zones inside them are only used to price/schedule the order, not to
  // grant coverage on their own.
  if (
    storeSettings?.locationGate?.enabled
    && storeSettings?.locationGate?.enforceCoverage !== false
    && customerPinLat != null
    && customerPinLng != null
  ) {
    const gate = storeSettings.locationGate;
    const coverageAreas = Array.isArray(gate?.coverageAreas)
      ? gate.coverageAreas.filter((a) => Number.isFinite(a?.lat) && Number.isFinite(a?.lng)
        && Number.isFinite(a?.radiusKm) && a.radiusKm > 0)
      : [];

    const notCoveredError = () => new AppError(
      lang === 'ar'
        ? 'عذراً! لا نغطي هذه المنطقة.'
        : 'Sorry! We do not deliver to this area.',
      400,
    );

    if (coverageAreas.length) {
      const withinAnyArea = coverageAreas.some(
        (area) => haversineKm({ lat: customerPinLat, lng: customerPinLng }, area) <= area.radiusKm,
      );
      if (!withinAnyArea) {
        throw notCoveredError();
      }
    } else {
      const activeZones = await listPublicDeliveryZones();
      if (anyZoneHasCoords(activeZones)
        && !findCoveringZone(activeZones, { lat: customerPinLat, lng: customerPinLng })) {
        throw notCoveredError();
      }
    }
  }

  const totals = await calculateCartTotals({
    items,
    deliveryMethod: deliveryMethod === 'recurring' ? 'recurring' : deliveryMethod,
    discountCode,
    pointsToRedeem,
    walletToSpend: Math.max(0, Number(walletToRedeem) || 0),
    user: req.user,
    deliveryZoneId: deliveryZone.id,
  });
  const marketplacePlan = totals.marketplacePlan;
  if (marketplacePlan.problems.length) {
    throw new AppError(marketplacePlan.problems[0], 400);
  }
  if (marketplacePlan.hasSellerItems && deliveryMethod === 'recurring') {
    throw new AppError(
      lang === 'ar'
        ? 'التوصيل الدوري متاح لمنتجات المتجر فقط — احذف منتجات البائعين أو اختر توصيلاً عادياً'
        : 'Recurring delivery is only available for store products — remove seller items or choose standard delivery',
      400,
    );
  }
  const scheduledLeadMinutes = resolveDeliveryLeadMinutes({
    deliveryMethod: 'scheduled',
    storeSettings,
    zone: deliveryZone,
  });
  const expressLeadMinutes = resolveDeliveryLeadMinutes({
    deliveryMethod: 'express',
    storeSettings,
    zone: deliveryZone,
  });

  if (deliveryMethod === 'express' && !isExpressAvailableNow({
    slots: deliveryZone.timeSlots,
    minLeadMinutes: expressLeadMinutes,
  })) {
    throw new AppError(
      resolveRequestLang(req.body) === 'ar'
        ? 'التوصيل السريع غير متاح الآن — جرّب التوصيل العادي أو اختر يوماً لاحقاً'
        : 'Express delivery is not available right now — try standard delivery or a later time',
      400,
    );
  }

  const needsSchedule = deliveryMethod === 'scheduled' || deliveryMethod === 'recurring';
  const activeSlots = (deliveryZone.timeSlots || []).filter((slot) => slot.isActive !== false);
  const selectedSlot = needsSchedule
    ? activeSlots.find((slot) => String(slot._id) === String(timeSlotId))
    : null;

  let parsedScheduledDate;
  if (needsSchedule) {
    if (!scheduledDate) {
      throw new AppError('Delivery date is required', 400);
    }
    if (!selectedSlot) {
      throw new AppError('Delivery time slot is required', 400);
    }
    const dateCheck = assertDeliveryDateInWindow(scheduledDate);
    if (!dateCheck.ok) {
      throw new AppError(dateCheck.message, 400);
    }
    const slotCheck = assertDeliverySlotAvailable({
      scheduledDate,
      slot: selectedSlot,
      slots: activeSlots,
      lang: resolveRequestLang(req.body),
      minLeadMinutes: scheduledLeadMinutes,
    });
    if (!slotCheck.ok) {
      throw new AppError(slotCheck.message, 400);
    }
    parsedScheduledDate = getEffectiveSlotStart({
      dateStr: slotCheck.dateKey,
      slot: selectedSlot,
      minLeadMinutes: scheduledLeadMinutes,
    });
  }

  if (deliveryMethod === 'recurring') {
    const allowed = ['weekly', 'biweekly', 'monthly'];
    if (!allowed.includes(recurringFrequency)) {
      throw new AppError('Recurring delivery frequency is required', 400);
    }
    if (recurringFrequency === 'monthly') {
      const day = Number(recurringPreferredDayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        throw new AppError('Choose a recurring day of month between 1 and 28', 400);
      }
    } else {
      const weekday = Number(recurringPreferredWeekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new AppError('Choose a recurring weekday', 400);
      }
    }
  }

  await syncInventoryReservations(
    req.user._id,
    items.map((item) => ({
      productId: item.productId || item.product,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
    resolveRequestLang(req.body),
  );

  const productIds = [...new Set(items.map((item) => item.productId || item.product).filter(Boolean))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
    : [];
  const productById = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  const orderItems = items.map((item) => {
    const pid = (item.productId || item.product)?.toString?.()
      || String(item.productId || item.product || '');
    const product = productById[pid];
    const line = product ? resolveProductLine(product, item.variantId) : null;
    return {
      product: item.productId || item.product,
      variantId: item.variantId || line?.variantId || null,
      sku: item.sku || line?.sku,
      variantLabelAr: item.variantLabelAr || line?.labelAr,
      variantLabelEn: item.variantLabelEn || line?.labelEn,
      nameAr: item.name || item.nameAr,
      nameEn: item.nameEn,
      price: item.price,
      wholesalePrice: line?.wholesalePrice ?? product?.wholesalePrice ?? 0,
      quantity: item.quantity,
      unit: item.unit,
      image: item.image || item.emoji || line?.image,
      ...(product?.seller ? {
        seller: product.seller,
        sellerNameAr: product.sellerNameAr,
        sellerNameEn: product.sellerNameEn,
        fulfilledBy: product.fulfilledBy || 'seller',
      } : { fulfilledBy: 'store' }),
    };
  });
  const sellerIds = [...new Set(marketplacePlan.sellerGroups.map((g) => g.sellerId))];

  // Claim the coupon redemption slot atomically BEFORE persisting the order.
  // reserveCouponRedemption only increments while usedCount < usageLimit, so two
  // concurrent checkouts can never drive a limited coupon past its cap. If a later
  // step fails, releaseCouponRedemption hands the slot back.
  let couponClaimed = null;
  if (totals.appliedCoupon?.code) {
    const reserved = await reserveCouponRedemption(totals.appliedCoupon.code);
    if (!reserved) {
      throw new AppError(
        lang === 'ar'
          ? 'نفدت صلاحية كود الخصم — لم يعد متاحاً'
          : 'This discount code is no longer available',
        409,
      );
    }
    couponClaimed = totals.appliedCoupon.code;
  }

  const orderNumber = await generateOrderNumber();

  let order;
  try {
    order = await Order.create({
      orderNumber,
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        label: enrichedShipping.label || shippingAddress.label,
        street: enrichedShipping.street,
        building: enrichedShipping.building,
        floor: enrichedShipping.floor,
        city: enrichedShipping.city || area,
        governorate: enrichedShipping.governorate,
        area: enrichedShipping.area || area,
        postalCode: enrichedShipping.postalCode,
        lat: customerPinLat,
        lng: customerPinLng,
        formattedAddress: enrichedShipping.formattedAddress || shippingAddress.formattedAddress || '',
        placeId: enrichedShipping.placeId || shippingAddress.placeId || '',
        locationSource: enrichedShipping.locationSource || shippingAddress.locationSource || '',
      },
      phone,
      alternatePhone: normalizedAlternatePhone || undefined,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      sellerShippingFee: totals.sellerShippingFee || 0,
      hasStoreItems: marketplacePlan.hasStoreItems,
      sellerIds,
      discount: totals.discountAmount,
      pointsRedeemed: totals.pointsRedeemed,
      pointsDiscount: totals.pointsDiscount,
      walletAmount: totals.walletApplied || 0,
      couponCode: totals.appliedCoupon?.code || discountCode || null,
      total: totals.total,
      paymentMethod,
      manualPaymentAccount: manualPaymentAccount || undefined,
      paymentProofUrl: paymentProofUrl || undefined,
      paymentProofPublicId: paymentProofPublicId || undefined,
      paymentProofUploadedAt: paymentProofUploadedAt || undefined,
      deliveryMethod,
      deliveryZone: /^[a-f\d]{24}$/i.test(deliveryZone._id) ? deliveryZone._id : null,
      deliveryZoneNameAr: deliveryZone.nameAr,
      deliveryZoneNameEn: deliveryZone.nameEn,
      deliveryTimeSlot: selectedSlot ? {
        labelAr: selectedSlot.labelAr,
        labelEn: selectedSlot.labelEn,
        from: selectedSlot.from,
        to: selectedSlot.to,
      } : undefined,
      scheduledDate: parsedScheduledDate,
      recurringDelivery: deliveryMethod === 'recurring' ? {
        frequency: recurringFrequency,
        preferredWeekday: recurringFrequency !== 'monthly' ? Number(recurringPreferredWeekday) : null,
        preferredDayOfMonth: recurringFrequency === 'monthly' ? Number(recurringPreferredDayOfMonth) : null,
        isFirstDelivery: true,
      } : undefined,
      notes,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      fulfillmentLocationId: fulfillmentLocation?._id ?? null,
      statusHistory: [{ status: 'pending', changedAt: new Date() }],
    });
  } catch (err) {
    // The coupon slot was already claimed above — hand it back if the order
    // itself couldn't be persisted, same as every other failure path below.
    if (couponClaimed) await releaseCouponRedemption(couponClaimed);
    throw err;
  }

  // Marketplace: split seller lines into shipments. Nothing else has happened yet
  // (points, wallet, stock), so a failure here only needs the order and coupon undone.
  try {
    await createShipmentsForOrder(order, marketplacePlan, {
      lineTotals: items.map((item) => calculatePromotedLineTotal(item)),
    });
  } catch (err) {
    if (couponClaimed) await releaseCouponRedemption(couponClaimed);
    await Order.findByIdAndDelete(order._id);
    throw err;
  }

  if (totals.pointsRedeemed > 0) {
    const updatedUser = await redeemPointsForOrder({
      userId: req.user._id,
      order,
      pointsRedeemed: totals.pointsRedeemed,
      pointsDiscount: totals.pointsDiscount,
    });
    if (!updatedUser) {
      if (couponClaimed) await releaseCouponRedemption(couponClaimed);
      await Order.findByIdAndDelete(order._id);
      throw new AppError('Your points balance changed. Please review checkout again.', 409);
    }
  }

  if (totals.walletApplied > 0) {
    const spent = await spendWalletForOrder({
      userId: req.user._id,
      order,
      walletApplied: totals.walletApplied,
    });
    if (!spent) {
      // Undo the points redemption we just committed, hand back the coupon slot,
      // then drop the order.
      if (totals.pointsRedeemed > 0) {
        await User.findByIdAndUpdate(req.user._id, {
          $inc: { pointsBalance: totals.pointsRedeemed },
          $push: {
            pointsHistory: {
              type: 'refund',
              points: totals.pointsRedeemed,
              amount: totals.pointsDiscount,
              note: 'Points restored — checkout could not be completed',
            },
          },
        });
      }
      if (couponClaimed) await releaseCouponRedemption(couponClaimed);
      await Order.findByIdAndDelete(order._id);
      throw new AppError('Your wallet balance changed. Please review checkout again.', 409);
    }
  }

  // Coupon usage is already committed by reserveCouponRedemption above; the
  // reservation stands once the order persists, so nothing to increment here.

  if (deliveryMethod === 'recurring') {
    try {
      const subscription = await createRecurringSubscription({
        userId: req.user._id,
        sourceOrderId: order._id,
        items: orderItems.map((item) => ({
          product: item.product,
          variantId: item.variantId,
          quantity: item.quantity,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          price: item.price,
          unit: item.unit,
          image: item.image,
        })),
        shippingAddress: order.shippingAddress,
        phone: order.phone,
        deliveryZone,
        deliveryTimeSlot: order.deliveryTimeSlot,
        frequency: recurringFrequency,
        preferredWeekday: Number(recurringPreferredWeekday),
        preferredDayOfMonth: Number(recurringPreferredDayOfMonth),
        startDate: parsedScheduledDate,
        // Later deliveries can't be charged online without the customer present, so a
        // subscription started with a gateway method collects cash on each delivery.
        paymentMethod: isOnlinePaymentMethod(paymentMethod) ? 'cod' : paymentMethod,
        notes,
      });
      order.recurringDelivery = {
        frequency: recurringFrequency,
        preferredWeekday: subscription.preferredWeekday,
        preferredDayOfMonth: subscription.preferredDayOfMonth,
        scheduleSummaryAr: subscription.scheduleSummaryAr,
        scheduleSummaryEn: subscription.scheduleSummaryEn,
        subscriptionId: subscription._id,
        isFirstDelivery: true,
      };
      await order.save();
    } catch (err) {
      // Roll back the just-created order so a failed subscription can't leave a
      // charged order behind, and hand the coupon slot back.
      if (couponClaimed) await releaseCouponRedemption(couponClaimed);
      await Order.findByIdAndDelete(order._id);
      throw err;
    }
  }

  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [] },
    { upsert: true },
  );

  await commitOrderInventory(req.user._id, orderItems);

  try {
    await awardPointsForOrder(order);
  } catch (err) {
    console.error('Loyalty award skipped:', err.message);
  }

  try {
    await notifyOrderCreated(order, req.user);
  } catch (err) {
    console.error('Order confirmation email failed:', err.message);
  }

  try {
    await notifyOrderTimeline(order, req.user, 'order_created');
  } catch (err) {
    console.error('Order created SMS failed:', err.message);
  }

  res.status(201).json({
    success: true,
    order: {
      id: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentMethod: order.paymentMethod,
      deliveryMethod: order.deliveryMethod,
      pointsRedeemed: order.pointsRedeemed,
      pointsDiscount: order.pointsDiscount,
      pointsEarned: order.pointsEarned || 0,
      walletAmount: order.walletAmount || 0,
      status: order.orderStatus,
      orderStatus: order.orderStatus,
    },
  });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  const orders = await Order.find({ user: req.user._id })
    .populate('assignedDriver', 'name phone')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    orders: orders.map((order) => {
      const formatted = formatOrder(order);
      if (order.assignedDriver) {
        formatted.assignedDriver = {
          _id: order.assignedDriver._id,
          name: order.assignedDriver.name,
          phone: order.assignedDriver.phone,
        };
      }
      formatted.trackingEnabled = order.trackingEnabled === true;
      formatted.canTrack = canShowOrderTracking(order, { gpsDeliveryEnabled });
      return formatted;
    }),
  });
});

export const getMyRecurringDeliveries = asyncHandler(async (req, res) => {
  const subscriptions = await getSubscriptionsForUser(req.user._id, { includeInactive: true });
  res.json({
    success: true,
    data: subscriptions.map((sub) => formatSubscription(sub, req.query.lang === 'en' ? 'en' : 'ar')),
  });
});

export const updateMyRecurringDelivery = asyncHandler(async (req, res) => {
  const result = await updateSubscription(req.user._id, req.params.id, req.body);
  if (result.error === 'not_found') throw new AppError('Recurring delivery not found', 404);
  if (result.error === 'validation') throw new AppError(result.message, 400);
  res.json({
    success: true,
    data: formatSubscription(result.sub, req.query.lang === 'en' ? 'en' : 'ar'),
  });
});

export const pauseMyRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await pauseSubscription(req.user._id, req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({ success: true, data: formatSubscription(sub) });
});

export const resumeMyRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await resumeSubscription(req.user._id, req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({ success: true, data: formatSubscription(sub) });
});

export const cancelMyRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await cancelSubscription(req.user._id, req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({ success: true, data: formatSubscription(sub) });
});

export const getAdminRecurringDeliveries = asyncHandler(async (req, res) => {
  const subscriptions = await getAdminSubscriptions({
    status: req.query.status,
    frequency: req.query.frequency,
    due: req.query.due,
    search: req.query.search,
  });
  res.json({
    success: true,
    data: subscriptions.map((sub) => ({
      ...formatSubscription(sub),
      customerName: sub.user?.name || '',
      customerPhone: sub.user?.phone || sub.phone,
      customerEmail: sub.user?.email || '',
      orderNumber: sub.sourceOrder?.orderNumber || '',
    })),
  });
});

export const getAdminRecurringStats = asyncHandler(async (req, res) => {
  const stats = await fetchAdminRecurringStats();
  res.json({ success: true, data: stats });
});

export const getAdminRecurringDeliveryById = asyncHandler(async (req, res) => {
  const sub = await getSubscriptionById(req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({
    success: true,
    data: {
      ...formatSubscription(sub),
      customerName: sub.user?.name || '',
      customerPhone: sub.user?.phone || sub.phone,
      customerEmail: sub.user?.email || '',
      orderNumber: sub.sourceOrder?.orderNumber || '',
    },
  });
});

export const updateAdminRecurringDelivery = asyncHandler(async (req, res) => {
  const result = await adminUpdateSubscription(req.params.id, req.body);
  if (result.error === 'not_found') throw new AppError('Recurring delivery not found', 404);
  if (result.error === 'validation') throw new AppError(result.message, 400);
  const sub = await getSubscriptionById(req.params.id);
  res.json({
    success: true,
    data: {
      ...formatSubscription(sub),
      customerName: sub.user?.name || '',
      customerPhone: sub.user?.phone || sub.phone,
      customerEmail: sub.user?.email || '',
      orderNumber: sub.sourceOrder?.orderNumber || '',
    },
  });
});

export const pauseAdminRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await adminPauseSubscription(req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({ success: true, data: formatSubscription(sub) });
});

export const resumeAdminRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await adminResumeSubscription(req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({ success: true, data: formatSubscription(sub) });
});

export const cancelAdminRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await adminCancelSubscription(req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found', 404);
  res.json({ success: true, data: formatSubscription(sub) });
});

export const advanceAdminRecurringDelivery = asyncHandler(async (req, res) => {
  const sub = await advanceSubscriptionDelivery(req.params.id);
  if (!sub) throw new AppError('Recurring delivery not found or not active', 404);
  const populated = await getSubscriptionById(req.params.id);
  res.json({
    success: true,
    data: {
      ...formatSubscription(populated),
      customerName: populated.user?.name || '',
      customerPhone: populated.user?.phone || populated.phone,
      orderNumber: populated.sourceOrder?.orderNumber || '',
    },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
    .populate('assignedDriver', 'name phone');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  await persistOrderDeliveredAtIfNeeded(order);

  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  res.json({ success: true, order: await formatOrderResponse(order, { gpsDeliveryEnabled }) });
});

export const calculateTotals = asyncHandler(async (req, res) => {
  const { items, deliveryMethod, discountCode, pointsToRedeem, walletToRedeem, deliveryZoneId } = req.body;
  const totals = await calculateCartTotals({
    items: items || [],
    deliveryMethod,
    discountCode,
    pointsToRedeem,
    walletToSpend: Math.max(0, Number(walletToRedeem) || 0),
    user: req.user,
    deliveryZoneId,
  });
  res.json({ success: true, ...totals });
});

export const getAdminOrderChats = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
  const q = (req.query.q || '').trim();

  const hasCustomerMessages = {
    messages: {
      $elemMatch: {
        authorRole: 'customer',
        isInternal: { $ne: true },
      },
    },
  };

  let filter = hasCustomerMessages;

  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter = {
      $and: [
        hasCustomerMessages,
        { $or: [{ orderNumber: rx }, { phone: rx }] },
      ],
    };
  }

  const orders = await Order.find(filter)
    .populate('user', 'name email phone')
    .sort({ updatedAt: -1 })
    .limit(2000);

  let items = orders.map(formatOrderChatListItem);

  if (unreadOnly) {
    items = items.filter((item) => item.unreadCustomerMessages > 0);
  }

  items.sort((a, b) => {
    const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });

  const total = items.length;
  const data = items.slice(skip, skip + limit);

  res.json({
    success: true,
    data,
    pagination: paginationMeta(page, limit, total),
  });
});

export const getAdminOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...buildAdminOrderFilter(req.query), ...NOT_TRASHED };
  const sort = parseSort(req.query, ADMIN_ORDER_SORT);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders.map((order) => ({
      ...formatOrder(order),
      unreadCustomerMessages: countUnreadCustomerMessages(order),
    })),
    pagination: paginationMeta(page, limit, total),
  });
});

export const exportAdminOrders = asyncHandler(async (req, res) => {
  const filter = { ...buildAdminOrderFilter(req.query), ...NOT_TRASHED };
  const sort = parseSort(req.query, ADMIN_ORDER_SORT);

  const orders = await Order.find(filter)
    .populate('user', 'name email phone')
    .sort(sort)
    .limit(5000);

  const csv = toCsv(orders, [
    { header: 'Order #', value: (o) => o.orderNumber },
    { header: 'Date', value: (o) => o.createdAt?.toISOString?.() || o.createdAt },
    { header: 'Customer', value: (o) => o.user?.name || o.phone },
    { header: 'Email', value: (o) => o.user?.email || '' },
    { header: 'Phone', value: (o) => o.phone },
    { header: 'Total', value: (o) => o.total },
    { header: 'Order Status', value: (o) => o.orderStatus },
    { header: 'Payment Status', value: (o) => o.paymentStatus },
    { header: 'Payment Method', value: (o) => o.paymentMethod },
  ]);

  sendCsv(res, 'orders.csv', csv);
});

export const getAdminOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  await persistOrderDeliveredAtIfNeeded(order);

  const unreadBefore = countUnreadCustomerMessages(order);
  if (unreadBefore > 0) {
    await markOrderMessagesReadByAdmin(order);
  }

  res.json({
    success: true,
    order: await formatOrderResponse(order, { isStaff: true }),
    hadUnreadCustomerMessages: unreadBefore > 0,
    unreadCustomerMessagesCleared: unreadBefore,
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const {
    orderStatus,
    paymentStatus,
    adminNotes,
    deliveryFailureReasonKey,
    deliveryFailureReason,
  } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const previousStatus = order.orderStatus;
  let statusNote = '';
  let autoAssignedDriver = null;

  if (orderStatus && orderStatus !== order.orderStatus) {
    if (!ORDER_STATUS_VALUES.includes(orderStatus)) {
      throw new AppError('Invalid order status', 400);
    }

    if (!order.fulfillmentLocationId && ['preparing', 'confirmed', 'out_for_delivery'].includes(orderStatus)) {
      const fulfillmentLocation = await resolveFulfillmentLocationForZone(order.deliveryZone);
      if (fulfillmentLocation) {
        order.fulfillmentLocationId = fulfillmentLocation._id;
      }
    }

    if (orderStatus === 'delivery_failed') {
      const applied = applyDeliveryFailureReason(order, {
        deliveryFailureReasonKey,
        deliveryFailureReason,
      });
      if (!applied.ok) {
        throw new AppError(applied.message, 400);
      }
      statusNote = getDeliveryFailureReasonForLang(order, 'ar');
    } else {
      clearDeliveryFailureReason(order);
    }

    order.orderStatus = orderStatus;
    if (orderStatus === 'out_for_delivery') {
      if (!order.assignedDriver) {
        autoAssignedDriver = await autoAssignDriverToOrder(order, { req });
      }
      if (order.assignedDriver) {
        await ensureOrderTracking(order);
      }
    }
    if (orderStatus === 'delivered' && previousStatus !== 'delivered') {
      order.deliveredAt = new Date();
      await completeOrderTracking(order._id);
    }
    if (orderStatus === 'delivery_failed' && previousStatus !== 'delivery_failed') {
      await completeOrderTracking(order._id);
    }
    pushStatusHistory(order, orderStatus, {
      changedBy: req.user._id,
      note: statusNote,
    });
  } else if (orderStatus === 'delivery_failed' && order.orderStatus === 'delivery_failed') {
    const applied = applyDeliveryFailureReason(order, {
      deliveryFailureReasonKey,
      deliveryFailureReason,
    });
    if (!applied.ok) {
      throw new AppError(applied.message, 400);
    }
  }

  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (orderStatus === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
    order.paymentStatus = 'paid';
  }
  if (adminNotes !== undefined) order.adminNotes = adminNotes;

  if (order.orderStatus === 'delivered' && !order.deliveredAt) {
    order.deliveredAt = new Date();
  }

  await order.save();

  try {
    await awardPointsForOrder(order);
  } catch (err) {
    console.error('Loyalty award skipped:', err.message);
  }

  if (orderStatus && orderStatus !== previousStatus) {
    try {
      await notifyOrderStatusChange(order._id, orderStatus, previousStatus);
    } catch (err) {
      console.error('Order status email failed:', err.message);
    }
    try {
      const populatedForNotify = await Order.findById(order._id).populate('user', 'name email phone');
      await notifyOrderTimeline(populatedForNotify, populatedForNotify.user, orderStatus);
      await notifyCustomerOrderStatus(
        populatedForNotify,
        populatedForNotify.user,
        orderStatus,
        previousStatus,
      ).catch((err) => console.error('Order tracking notify failed:', err.message));
      if (orderStatus === 'delivered' && previousStatus !== 'delivered') {
        const { sendReviewRequest } = await import('../services/reviewRequest.service.js');
        await sendReviewRequest(populatedForNotify, populatedForNotify.user, 'ar').catch((err) => {
          console.error('Review request failed:', err.message);
        });
      }
    } catch (err) {
      console.error('Order status SMS failed:', err.message);
    }
    await logAudit({
      req,
      action: 'status_change',
      entityType: 'order',
      entityId: order._id,
      entityLabel: order.orderNumber,
      changes: {
        orderStatus: { from: previousStatus, to: orderStatus },
        ...(orderStatus === 'delivery_failed'
          ? { deliveryFailureReason: getDeliveryFailureReasonForLang(order, 'ar') }
          : {}),
      },
    });
  }

  if (autoAssignedDriver) {
    try {
      const populatedForDriver = await Order.findById(order._id)
        .populate('user', 'name email phone')
        .populate('assignedDriver', 'name phone');
      await notifyCustomerDriverAssigned(
        populatedForDriver,
        populatedForDriver.user,
        populatedForDriver.assignedDriver,
      );
      await notifyCustomerTrackingLive(populatedForDriver, populatedForDriver.user)
        .catch((err) => console.error('Tracking live notify failed:', err.message));
    } catch (err) {
      console.error('Auto-assign driver notify failed:', err.message);
    }
  }

  const populated = await Order.findById(order._id)
    .populate('user', 'name email phone')
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');
  res.json({ success: true, order: await formatOrderResponse(populated, { isStaff: true }) });
});
