import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { calculateCartTotals, validateCoupon } from '../utils/cartCalculations.js';
import {
  resolveProductLine,
  getAvailableStock,
  normalizeVariantId,
} from '../utils/productCatalog.js';
import { formatInsufficientStockMessage } from '../utils/stockMessages.js';
import {
  pushStatusHistory,
} from './orderManagement.service.js';
import {
  calculateEarnPointsFromTotal,
  getLoyaltySettings,
  pointsToCashValue,
  getCashbackPercent,
} from './loyalty.service.js';
import User from '../models/User.js';

/** Editable until admin marks out for delivery. */
export const CUSTOMER_EDITABLE_STATUSES = new Set(['pending', 'confirmed', 'preparing']);

export function isCustomerEditableOrder(order) {
  if (!order) return false;
  if (!CUSTOMER_EDITABLE_STATUSES.has(order.orderStatus)) return false;
  if (order.paymentStatus === 'paid') return false;
  // Marketplace orders are split into seller shipments at checkout — lines are fixed.
  if (order.sellerIds?.length) return false;
  if ((order.substitutions || []).some((sub) => sub.status === 'pending')) return false;
  return true;
}

export function assertCustomerCanEditOrder(order, lang = 'ar') {
  const isAr = lang === 'ar';
  if (!order) {
    throw new AppError(isAr ? 'الطلب غير موجود' : 'Order not found', 404);
  }
  if (order.orderStatus === 'cancelled') {
    throw new AppError(isAr ? 'لا يمكن تعديل طلب ملغي' : 'Cancelled orders cannot be edited', 400);
  }
  if (order.sellerIds?.length) {
    throw new AppError(
      isAr ? 'هذا الطلب يحتوي على منتجات من بائعين آخرين ولا يمكن تعديله — يمكنك إلغاؤه وإعادة الطلب' : 'Orders with marketplace items cannot be edited — cancel and order again instead',
      400,
    );
  }
  if (order.orderStatus === 'out_for_delivery') {
    throw new AppError(
      isAr ? 'لا يمكن تعديل الطلب بعد أن أصبح في الطريق إليك' : 'This order can no longer be edited — it is already out for delivery',
      400,
    );
  }
  if (!CUSTOMER_EDITABLE_STATUSES.has(order.orderStatus)) {
    throw new AppError(isAr ? 'لا يمكن تعديل هذا الطلب' : 'This order can no longer be edited', 400);
  }
  if (order.paymentStatus === 'paid') {
    throw new AppError(
      isAr ? 'لا يمكن تعديل الطلب بعد الدفع الإلكتروني — تواصل معنا للمساعدة' : 'Paid online orders cannot be edited — please contact support',
      400,
    );
  }
  if ((order.substitutions || []).some((sub) => sub.status === 'pending')) {
    throw new AppError(
      isAr ? 'يرجى الرد على اقتراح البديل قبل تعديل الطلب' : 'Please respond to the product substitution suggestion before editing',
      400,
    );
  }
}

function itemKey(productId, variantId) {
  return `${String(productId)}:${variantId ? String(variantId) : ''}`;
}

function aggregateQuantities(items) {
  const map = new Map();
  for (const item of items) {
    const productId = item.product || item.productId;
    if (!productId) continue;
    const variantId = item.variantId ? normalizeVariantId(item.variantId) : null;
    const key = itemKey(productId, variantId);
    map.set(key, {
      productId,
      variantId,
      quantity: (map.get(key)?.quantity || 0) + Number(item.quantity || 0),
    });
  }
  return map;
}

async function adjustStock({ productId, variantId, delta, lang = 'ar' }) {
  const product = await Product.findById(productId);
  if (!product?.isActive) {
    throw new AppError(`Product unavailable: ${productId}`, 400);
  }

  const line = resolveProductLine(product, variantId);
  if (!line) throw new AppError('Invalid product variant', 400);

  if (delta > 0) {
    const available = getAvailableStock(line);
    if (available < delta) {
      throw new AppError(formatInsufficientStockMessage(line, lang), 400);
    }
  }

  if (variantId && product.variants?.length) {
    const variant = product.variants.id(variantId);
    if (!variant) throw new AppError('Invalid product variant', 400);
    if (delta > 0) {
      variant.stock = Math.max(0, (variant.stock || 0) - delta);
      product.soldCount = (product.soldCount || 0) + delta;
    } else {
      const restore = Math.abs(delta);
      variant.stock = (variant.stock || 0) + restore;
      product.soldCount = Math.max(0, (product.soldCount || 0) - restore);
    }
  } else if (delta > 0) {
    product.stock = Math.max(0, (product.stock || 0) - delta);
    product.soldCount = (product.soldCount || 0) + delta;
  } else {
    const restore = Math.abs(delta);
    product.stock = (product.stock || 0) + restore;
    product.soldCount = Math.max(0, (product.soldCount || 0) - restore);
  }

  await product.save({ validateBeforeSave: false });
}

async function applyInventoryDelta(previousItems, nextItems, lang) {
  const prevMap = aggregateQuantities(previousItems);
  const nextMap = aggregateQuantities(nextItems);
  const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);

  for (const key of keys) {
    const prevQty = prevMap.get(key)?.quantity || 0;
    const nextQty = nextMap.get(key)?.quantity || 0;
    const delta = nextQty - prevQty;
    if (delta === 0) continue;
    const { productId, variantId } = nextMap.get(key) || prevMap.get(key);
    await adjustStock({ productId, variantId, delta, lang });
  }
}

async function resolveOrderItemsFromPayload(rawItems, lang = 'ar') {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AppError(lang === 'ar' ? 'يجب أن يحتوي الطلب على منتج واحد على الأقل' : 'Order must contain at least one item', 400);
  }

  const merged = aggregateQuantities(rawItems.map((item) => ({
    productId: item.productId || item.product,
    variantId: item.variantId,
    quantity: item.quantity,
  })));

  const resolved = [];
  for (const { productId, variantId, quantity } of merged.values()) {
    const product = await Product.findById(productId);
    if (!product?.isActive) {
      throw new AppError(lang === 'ar' ? 'أحد المنتجات غير متاح' : 'One of the products is unavailable', 400);
    }
    const line = resolveProductLine(product, variantId);
    if (!line) throw new AppError('Invalid product variant', 400);

    resolved.push({
      product: productId,
      variantId: line.variantId || null,
      sku: line.sku,
      variantLabelAr: line.labelAr,
      variantLabelEn: line.labelEn,
      nameAr: product.nameAr || product.name,
      nameEn: product.nameEn,
      price: line.price ?? product.price,
      wholesalePrice: line.wholesalePrice ?? product.wholesalePrice ?? 0,
      quantity,
      unit: product.unit,
      image: line.image || product.image || product.emoji,
    });
  }

  return resolved;
}

async function recalculateEarnedPoints(order) {
  if (order.pointsEarned > 0) {
    await User.findByIdAndUpdate(order.user, {
      $inc: { pointsBalance: -order.pointsEarned },
      $push: {
        pointsHistory: {
          type: 'adjust',
          points: -order.pointsEarned,
          order: order._id,
          note: `Points reversed — order ${order.orderNumber} updated`,
        },
      },
    });
    order.pointsEarned = 0;
  }

  const loyalty = await getLoyaltySettings();
  const points = calculateEarnPointsFromTotal(order.total, loyalty);
  if (points <= 0) return;

  const cashValue = pointsToCashValue(points, loyalty);
  const expiresAt = loyalty.expiryDays > 0
    ? new Date(Date.now() + loyalty.expiryDays * 24 * 60 * 60 * 1000)
    : null;

  await User.findByIdAndUpdate(order.user, {
    $inc: { pointsBalance: points },
    $push: {
      pointsHistory: {
        type: 'earn',
        points,
        order: order._id,
        amount: order.total,
        note: `Cashback ${getCashbackPercent(loyalty)}% — order ${order.orderNumber} updated (+${cashValue} EGP)`,
        expiresAt,
      },
    },
  });
  order.pointsEarned = points;
}

export async function updateCustomerOrderItems(order, rawItems, { user, lang = 'ar' } = {}) {
  assertCustomerCanEditOrder(order, lang);

  const previousItems = order.items.map((item) => ({ ...item.toObject?.() || item }));
  const nextItems = await resolveOrderItemsFromPayload(rawItems, lang);

  await applyInventoryDelta(previousItems, nextItems, lang);

  const totals = await calculateCartTotals({
    items: nextItems.map((item) => ({
      productId: item.product,
      variantId: item.variantId,
      price: item.price,
      quantity: item.quantity,
    })),
    deliveryMethod: order.deliveryMethod || 'scheduled',
    discountCode: order.couponCode || undefined,
    pointsToRedeem: order.pointsRedeemed || 0,
    user,
    deliveryZoneId: order.deliveryZone,
  });

  if (order.couponCode) {
    const couponCheck = await validateCoupon(order.couponCode, totals.subtotal);
    if (!couponCheck.valid) {
      throw new AppError(
        lang === 'ar'
          ? 'لا يمكن تطبيق كود الخصم بعد هذا التعديل — عدّل الكميات أو تواصل معنا'
          : 'The discount code no longer applies after this change — adjust quantities or contact us',
        400,
      );
    }
  }

  order.items = nextItems;
  order.subtotal = totals.subtotal;
  order.deliveryFee = totals.deliveryFee;
  order.discount = totals.discountAmount;
  order.pointsDiscount = totals.pointsDiscount;
  order.total = totals.total;
  order.lastEditedAt = new Date();
  order.lastEditedBy = user?._id || order.user;

  pushStatusHistory(order, order.orderStatus, {
    note: lang === 'ar' ? 'عدّل العميل محتويات الطلب' : 'Customer updated order items',
    changedBy: user?._id,
  });

  await order.save();
  await recalculateEarnedPoints(order);
  await order.save();

  return order;
}

export function getCustomerEditBlockReason(order, lang = 'ar') {
  const isAr = lang === 'ar';
  if (!order) return isAr ? 'الطلب غير موجود' : 'Order not found';
  if (order.orderStatus === 'out_for_delivery') {
    return isAr ? 'الطلب في الطريق إليك ولا يمكن تعديله' : 'Order is out for delivery and cannot be edited';
  }
  if (order.orderStatus === 'cancelled') {
    return isAr ? 'الطلب ملغي' : 'Order is cancelled';
  }
  if (order.sellerIds?.length) {
    return isAr ? 'طلبات البائعين لا يمكن تعديلها' : 'Orders with marketplace items cannot be edited';
  }
  if (['delivered', 'delivery_failed', 'returned'].includes(order.orderStatus)) {
    return isAr ? 'تم إغلاق هذا الطلب' : 'This order is closed';
  }
  if (order.paymentStatus === 'paid') {
    return isAr ? 'تم الدفع الإلكتروني — تواصل معنا للتعديل' : 'Paid online — contact us to edit';
  }
  if ((order.substitutions || []).some((sub) => sub.status === 'pending')) {
    return isAr ? 'يرجى الرد على اقتراح البديل أولاً' : 'Respond to the substitution suggestion first';
  }
  if (!CUSTOMER_EDITABLE_STATUSES.has(order.orderStatus)) {
    return isAr ? 'لا يمكن تعديل هذا الطلب' : 'This order cannot be edited';
  }
  return null;
}
