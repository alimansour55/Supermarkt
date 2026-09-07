import { cartService, orderService } from '../services/apiServices';
import {
  getEarliestBooking,
  getEffectiveSlotStart,
  isExpressAvailableNow,
  resolveSelectedSlot,
} from '../utils/deliverySlotAvailability';
import { resolveDeliveryLeadMinutes } from '../utils/deliveryLeadTime';
import { localToEgyptPhone, parseLocalPhone } from './phoneHelpers';
import { isGpsDeliveryEnabled } from './gpsDelivery';

function resolveSavedAddress(user, addressId) {
  const addresses = user?.addresses || [];
  if (!addresses.length) return null;
  if (addressId) {
    return addresses.find((item) => String(item._id) === String(addressId)) || null;
  }
  return addresses.find((item) => item.isDefault) || addresses[0];
}

function extractApiError(err, fallback, isAr = false) {
  const data = err?.response?.data;
  const raw = data?.errors?.[0]?.msg || data?.message || err?.message || fallback;
  if (raw === 'Network Error' || err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED') {
    return isAr
      ? 'تعذّر الاتصال بالخادم. تحقق من الإنترنت أو أكمل الطلب من صفحة الدفع.'
      : 'Could not reach the server. Check your connection or use the checkout page.';
  }
  if (raw === 'Invalid value') {
    const field = data?.errors?.[0]?.path || data?.errors?.[0]?.param || '';
    if (field.includes('lat') || field.includes('lng')) {
      return isAr
        ? 'يرجى تحديث عنوانك وتحديد الموقع على الخريطة من «عناويني».'
        : 'Please update your address and pin it on the map in My Addresses.';
    }
    if (field.includes('price')) {
      return isAr ? 'سعر أحد المنتجات غير صالح — أعد إضافته للسلة' : 'A cart item has an invalid price — re-add it to your cart';
    }
    if (field.includes('scheduledDate') || field.includes('timeSlotId')) {
      return isAr ? 'موعد التوصيل غير متاح — جرّب مرة أخرى' : 'Delivery slot is unavailable — please try again';
    }
    if (field.includes('paymentMethod')) {
      return isAr ? 'طريقة الدفع غير مدعومة' : 'Payment method is not supported';
    }
  }
  return raw;
}

function hasValidCoords(address) {
  const lat = Number(address?.lat);
  const lng = Number(address?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function buildShippingAddress(saved, location, isAr) {
  const address = {
    label: saved.label || 'Delivery',
    street: saved.street.trim(),
    building: saved.building || undefined,
    floor: saved.floor || undefined,
    city: saved.city || (isAr ? location.nameAr : location.nameEn),
    governorate: saved.governorate || (isAr ? location.cityAr : location.cityEn),
    area: saved.area || (isAr ? location.areaAr : location.areaEn),
    postalCode: saved.postalCode || undefined,
    formattedAddress: saved.formattedAddress || undefined,
    placeId: saved.placeId || undefined,
    locationSource: saved.locationSource || undefined,
  };
  if (hasValidCoords(saved)) {
    address.lat = Number(saved.lat);
    address.lng = Number(saved.lng);
  }
  return address;
}

function normalizeOrderItems(items) {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId || undefined,
    quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    price: Number(item.price) || 0,
    name: item.name,
    nameAr: item.name || item.nameAr,
    nameEn: item.nameEn || item.name,
    image: item.image,
    emoji: item.emoji,
    slug: item.slug,
    sku: item.sku,
  }));
}

function normalizePaymentMethod(method) {
  const normalized = String(method || 'cod').trim().toLowerCase();
  if (['stripe', 'cod', 'instapay', 'vodafone_cash'].includes(normalized)) return normalized;
  return 'cod';
}

function serializeScheduledDate(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Pick a valid delivery method + schedule for chat checkout.
 * Uses user-selected schedule when provided; otherwise falls back to earliest slot.
 */
function resolveAssistantDelivery({
  deliveryMethod,
  location,
  storeSettings,
  isAr,
  scheduledDate,
  scheduledTime,
}) {
  const now = new Date();
  const timeSlots = location?.timeSlots || [];
  const scheduledLeadMinutes = resolveDeliveryLeadMinutes({
    deliveryMethod: 'scheduled',
    storeSettings,
    zone: location,
  });
  const expressLeadMinutes = resolveDeliveryLeadMinutes({
    deliveryMethod: 'express',
    storeSettings,
    zone: location,
  });

  const buildScheduled = (method = 'scheduled', dateStr, timeSlotId) => {
    const slot = resolveSelectedSlot(timeSlots, timeSlotId, dateStr, now, scheduledLeadMinutes);
    if (dateStr && slot?._id) {
      return {
        deliveryMethod: method,
        scheduledDate: getEffectiveSlotStart({
          dateStr,
          slot,
          referenceDate: now,
          minLeadMinutes: scheduledLeadMinutes,
        }),
        timeSlotId: slot._id,
      };
    }
    const earliest = getEarliestBooking({
      slots: timeSlots,
      referenceDate: now,
      minLeadMinutes: scheduledLeadMinutes,
    });
    if (!earliest?.slot?._id) return null;
    return {
      deliveryMethod: method,
      scheduledDate: getEffectiveSlotStart({
        dateStr: earliest.date,
        slot: earliest.slot,
        referenceDate: now,
        minLeadMinutes: scheduledLeadMinutes,
      }),
      timeSlotId: earliest.slot._id,
    };
  };

  if (deliveryMethod === 'express') {
    if (isExpressAvailableNow({
      slots: timeSlots,
      referenceDate: now,
      minLeadMinutes: expressLeadMinutes,
    })) {
      return { deliveryMethod: 'express', scheduledDate: undefined, timeSlotId: undefined };
    }
    const scheduled = buildScheduled('scheduled');
    if (scheduled) return scheduled;
  }

  if (deliveryMethod === 'scheduled' || deliveryMethod === 'recurring') {
    const scheduled = buildScheduled(
      deliveryMethod,
      scheduledDate,
      scheduledTime,
    );
    if (scheduled) return scheduled;
  }

  if (isExpressAvailableNow({
    slots: timeSlots,
    referenceDate: now,
    minLeadMinutes: expressLeadMinutes,
  })) {
    return { deliveryMethod: 'express', scheduledDate: undefined, timeSlotId: undefined };
  }

  const fallback = buildScheduled('scheduled');
  if (fallback) return fallback;

  throw new Error(isAr
    ? 'لا توجد مواعيد توصيل متاحة حالياً. جرّب لاحقاً أو أكمل من صفحة الدفع.'
    : 'No delivery slots available right now. Try later or use the checkout page.');
}

async function postOrderRequest(payload) {
  return orderService.create(payload);
}

export async function placeAssistantOrder({
  items,
  user,
  location,
  language,
  deliveryMethod,
  discountCode,
  addressId,
  paymentMethod,
  storeSettings,
  scheduledDate,
  scheduledTime,
  recurringFrequency,
  recurringPreferredWeekday,
  recurringPreferredDayOfMonth,
}) {
  const isAr = language === 'ar';
  const saved = resolveSavedAddress(user, addressId);
  if (!saved?.street?.trim()) {
    throw new Error(isAr ? 'يرجى إضافة عنوان توصيل محفوظ أولاً' : 'Please add a saved delivery address first');
  }

  if (isGpsDeliveryEnabled(storeSettings) && !hasValidCoords(saved)) {
    throw new Error(isAr
      ? 'يرجى تحديث عنوانك وتحديد الموقع على الخريطة من «عناويني» قبل إتمام الطلب.'
      : 'Please update your address and pin it on the map in My Addresses before checkout.');
  }

  const phoneLocal = parseLocalPhone(user?.phoneDisplay || user?.phone || '');
  if (!phoneLocal || phoneLocal.length < 10) {
    throw new Error(isAr ? 'يرجى تحديث رقم هاتفك في حسابك' : 'Please update your phone number in your account');
  }

  if (!items?.length) {
    throw new Error(isAr ? 'السلة فارغة' : 'Your cart is empty');
  }

  if (!location?.id) {
    throw new Error(isAr ? 'يرجى اختيار منطقة التوصيل من أعلى الموقع' : 'Please select a delivery area at the top of the site');
  }

  const delivery = resolveAssistantDelivery({
    deliveryMethod,
    location,
    storeSettings,
    isAr,
    scheduledDate,
    scheduledTime,
  });

  try {
    await cartService.reserve(
      items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      language,
    );
  } catch (err) {
    throw new Error(extractApiError(err, isAr ? 'تعذّر حجز المخزون' : 'Could not reserve stock', isAr), { cause: err });
  }

  const orderItems = normalizeOrderItems(items);
  const shippingAddress = buildShippingAddress(saved, location, isAr);
  const normalizedPayment = normalizePaymentMethod(paymentMethod);
  const serializedDate = serializeScheduledDate(delivery.scheduledDate);
  const timeSlotId = delivery.timeSlotId ? String(delivery.timeSlotId) : undefined;
  const resolvedMethod = deliveryMethod === 'recurring' ? 'recurring' : delivery.deliveryMethod;

  if ((resolvedMethod === 'scheduled' || resolvedMethod === 'recurring') && (!serializedDate || !timeSlotId)) {
    throw new Error(isAr
      ? 'لا توجد مواعيد توصيل متاحة حالياً. جرّب لاحقاً أو أكمل من صفحة الدفع.'
      : 'No delivery slots available right now. Try later or use the checkout page.');
  }

  const orderPayload = {
    lang: language,
    items: orderItems,
    shippingAddress,
    area: isAr ? location.areaAr : location.areaEn,
    phone: localToEgyptPhone(phoneLocal),
    paymentMethod: normalizedPayment,
    deliveryMethod: resolvedMethod,
    scheduledDate: serializedDate,
    deliveryZoneId: location.id,
    timeSlotId,
    discountCode: discountCode || undefined,
    recurringFrequency: resolvedMethod === 'recurring' ? recurringFrequency : undefined,
    recurringPreferredWeekday: resolvedMethod === 'recurring' && recurringFrequency !== 'monthly'
      ? Number(recurringPreferredWeekday)
      : undefined,
    recurringPreferredDayOfMonth: resolvedMethod === 'recurring' && recurringFrequency === 'monthly'
      ? Number(recurringPreferredDayOfMonth)
      : undefined,
  };

  try {
    const { data } = await postOrderRequest(orderPayload);
    return data;
  } catch (err) {
    const isNetwork = !err?.response && (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error'));
    if (isNetwork) {
      try {
        const { data } = await postOrderRequest(orderPayload);
        return data;
      } catch (retryErr) {
        throw new Error(extractApiError(retryErr, isAr ? 'تعذّر إتمام الطلب' : 'Could not place order', isAr), { cause: retryErr });
      }
    }
    throw new Error(extractApiError(err, isAr ? 'تعذّر إتمام الطلب' : 'Could not place order', isAr), { cause: err });
  }
}
