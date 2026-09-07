import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, ShieldCheck, StickyNote, Truck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatters';
import { cartService, loyaltyService, orderService, paymentService } from '../services/apiServices';
import PhoneInput from '../components/ui/PhoneInput';
import LocationSelector from '../components/layout/LocationSelector';
import AddressMapCapture from '../components/maps/AddressMapCapture';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import { emptyAddressCapture, hasAddressPin } from '../utils/parseGooglePlace';
import { isGpsDeliveryEnabled } from '../utils/gpsDelivery';
import CheckoutSidebarSummary from '../components/checkout/CheckoutSidebarSummary';
import DeliveryMethodSelector, { resolveSelectedSlot } from '../components/checkout/DeliveryMethodSelector';
import { defaultBookingDate, isDateWithinBookingWindow } from '../constants/deliveryOptions';
import {
  getEffectiveSlotStart,
  isSlotAvailableForDate,
  slotAvailabilityError,
} from '../utils/deliverySlotAvailability';
import { resolveDeliveryLeadMinutes } from '../utils/deliveryLeadTime';
import { localToEgyptPhone, parseLocalPhone } from '../utils/phoneHelpers';
import { calculateEarnPoints, getCashbackPercent, pointsToCashValue } from '../utils/loyaltyHelpers';
import { getCheckoutPromoReassurance } from '../utils/cartPromotion';
import { resolveFreeDeliveryMethods } from '../utils/freeDelivery';
import ManualTransferPaymentPanel from '../components/checkout/ManualTransferPaymentPanel';
import { requiresPaymentProof } from '../constants/paymentMethods';

function CheckoutSection({ step, title, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3.5 sm:px-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
          {step}
        </span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />}
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default function CheckoutPage() {
  const { t, language } = useLanguage();
  const {
    items,
    subtotal,
    discountAmount,
    total,
    discountCode,
    deliveryMethod,
    appliedCoupon,
    clearCart,
    setDeliveryMethod,
  } = useCart();
  const { location, refetchZones } = useLocation();
  const { settings } = useStoreSettings();
  const gpsMapEnabled = isGpsDeliveryEnabled(settings);
  const { isAuthenticated, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const isAr = language === 'ar';
  const checkoutPromoNote = useMemo(
    () => getCheckoutPromoReassurance(items, isAr),
    [items, isAr],
  );
  const paymentOptions = useMemo(() => (
    (settings?.paymentMethods || [])
      .filter((method) => method.enabled !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  ), [settings?.paymentMethods]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const selectedPaymentMethod = useMemo(
    () => paymentOptions.find((method) => method.id === paymentMethod) || null,
    [paymentMethod, paymentOptions],
  );
  const [manualPaymentAccount, setManualPaymentAccount] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [manualPaymentError, setManualPaymentError] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [loyalty, setLoyalty] = useState(null);
  const [address, setAddress] = useState(emptyAddressCapture);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [form, setForm] = useState({
    phoneLocal: parseLocalPhone(user?.phoneDisplay || user?.phone || ''),
    alternatePhoneLocal: '',
    notes: '',
    scheduledDate: defaultBookingDate(),
    scheduledTime: '',
    recurringFrequency: 'weekly',
    recurringPreferredWeekday: new Date().getDay(),
    recurringPreferredDayOfMonth: new Date().getDate(),
  });
  const timeSlots = useMemo(
    () => (location?.timeSlots?.length ? location.timeSlots : []),
    [location?.timeSlots],
  );
  const scheduledLeadMinutes = useMemo(
    () => resolveDeliveryLeadMinutes({ deliveryMethod: 'scheduled', storeSettings: settings, zone: location }),
    [settings, location],
  );
  const selectedSlot = resolveSelectedSlot(
    timeSlots,
    form.scheduledTime,
    form.scheduledDate,
    new Date(),
    scheduledLeadMinutes,
  );

  useEffect(() => {
    if (!user?.addresses?.length) return;
    const saved = user.addresses.find((item) => item.isDefault) || user.addresses[0];
    if (!saved) return;
    setAddress({
      street: saved.street || '',
      building: saved.building || '',
      floor: saved.floor || '',
      city: saved.city || '',
      governorate: saved.governorate || '',
      area: saved.area || '',
      postalCode: saved.postalCode || '',
      lat: saved.lat ?? null,
      lng: saved.lng ?? null,
      formattedAddress: saved.formattedAddress || '',
      placeId: saved.placeId || '',
    });
    setSelectedSavedAddressId(saved._id || '');
  }, [user?.addresses]);

  useEffect(() => {
    refetchZones?.();
  }, [refetchZones]);

  const applySavedAddress = (addressId) => {
    setSelectedSavedAddressId(addressId);
    if (!addressId) {
      setAddress(emptyAddressCapture());
      return;
    }
    const saved = user?.addresses?.find((item) => item._id === addressId);
    if (!saved) return;
    setAddress({
      street: saved.street || '',
      building: saved.building || '',
      floor: saved.floor || '',
      city: saved.city || '',
      governorate: saved.governorate || '',
      area: saved.area || '',
      postalCode: saved.postalCode || '',
      lat: saved.lat ?? null,
      lng: saved.lng ?? null,
      formattedAddress: saved.formattedAddress || '',
      placeId: saved.placeId || '',
    });
  };

  useEffect(() => {
    if (!items.length) {
      setCheckoutQuote(null);
      setQuoteLoading(false);
      setQuoteRefreshing(false);
      return undefined;
    }

    let cancelled = false;
    const isInitial = checkoutQuote == null;
    if (isInitial) setQuoteLoading(true);
    else setQuoteRefreshing(true);

    orderService.calculate({
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        price: item.price,
        quantity: item.quantity,
      })),
      deliveryMethod,
      discountCode: discountCode || undefined,
      deliveryZoneId: location?.id,
      pointsToRedeem: isAuthenticated ? Math.max(0, Math.floor(Number(pointsToRedeem) || 0)) : 0,
    }).then(({ data }) => {
      if (cancelled) return;
      setCheckoutQuote(data);
    }).catch(() => {
      if (!cancelled) setCheckoutQuote(null);
    }).finally(() => {
      if (!cancelled) {
        setQuoteLoading(false);
        setQuoteRefreshing(false);
      }
    });

    return () => { cancelled = true; };
  }, [items, deliveryMethod, discountCode, location?.id, isAuthenticated, pointsToRedeem]);

  const quotedSubtotal = checkoutQuote?.subtotal ?? subtotal;
  const quotedDiscountAmount = checkoutQuote?.discountAmount ?? discountAmount;
  const quotedTotal = checkoutQuote?.total ?? total;

  useEffect(() => {
    if (!paymentOptions.length) return;
    if (!paymentOptions.some((method) => method.id === paymentMethod)) {
      setPaymentMethod(paymentOptions[0].id);
    }
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let mounted = true;
    loyaltyService.getMe(language)
      .then(({ data }) => {
        if (mounted) setLoyalty(data);
      })
      .catch(() => {
        if (mounted) setLoyalty(null);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, language]);

  useEffect(() => {
    if (deliveryMethod === 'express' && location?.expressAvailable === false) {
      setDeliveryMethod('scheduled');
    }
    if (deliveryMethod === 'scheduled' && location?.scheduledAvailable === false && location?.expressAvailable) {
      setDeliveryMethod('express');
    }
  }, [deliveryMethod, location?.expressAvailable, location?.scheduledAvailable, setDeliveryMethod]);

  const patchForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const pointsPreview = useMemo(() => {
    const rules = loyalty?.rules || {};
    const requested = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
    const balance = Math.max(0, Number(loyalty?.pointsBalance ?? user?.pointsBalance ?? 0));
    const redeemValue = Number(rules.redemptionEGPPerPoint ?? 0);
    const maxPercent = Number(rules.maxRedeemPercent ?? 0);
    const redeemableBase = Math.max(0, quotedSubtotal - quotedDiscountAmount);
    const maxDiscount = Math.round(redeemableBase * (maxPercent / 100) * 100) / 100;

    const minRedeem = Number(rules.minRedeemPoints ?? 10);
    const baseEarnPoints = calculateEarnPoints(quotedTotal, rules);
    const serverPointsRedeemed = Math.max(0, Number(checkoutQuote?.pointsRedeemed || 0));
    const serverPointsDiscount = Math.max(0, Number(checkoutQuote?.pointsDiscount || 0));

    if (serverPointsRedeemed > 0 && serverPointsDiscount > 0) {
      return {
        pointsRedeemed: serverPointsRedeemed,
        pointsDiscount: serverPointsDiscount,
        estimatedTotal: quotedTotal,
        balance,
        earnPoints: baseEarnPoints,
        earnCash: pointsToCashValue(baseEarnPoints, rules),
        cashbackPercent: getCashbackPercent(rules),
      };
    }

    if (!rules.enabled || requested <= 0 || redeemValue <= 0 || requested < minRedeem || requested > balance) {
      return {
        pointsRedeemed: 0,
        pointsDiscount: 0,
        estimatedTotal: quotedTotal,
        balance,
        earnPoints: baseEarnPoints,
        earnCash: pointsToCashValue(baseEarnPoints, rules),
        cashbackPercent: getCashbackPercent(rules),
      };
    }

    const pointsDiscount = Math.min(Math.round(requested * redeemValue * 100) / 100, maxDiscount, quotedTotal);
    const pointsRedeemed = Math.min(requested, Math.ceil(pointsDiscount / redeemValue));
    const estimatedTotal = Math.max(0, Math.round((quotedTotal - pointsDiscount) * 100) / 100);
    const finalEarnPoints = calculateEarnPoints(estimatedTotal, rules);

    return {
      pointsRedeemed,
      pointsDiscount,
      estimatedTotal,
      balance,
      earnPoints: finalEarnPoints,
      earnCash: pointsToCashValue(finalEarnPoints, rules),
      cashbackPercent: getCashbackPercent(rules),
    };
  }, [checkoutQuote?.pointsDiscount, checkoutQuote?.pointsRedeemed, quotedDiscountAmount, quotedSubtotal, quotedTotal, loyalty, pointsToRedeem, user?.pointsBalance]);

  const manualTransferTotal = pointsPreview.estimatedTotal ?? checkoutQuote?.total ?? total;

  useEffect(() => {
    setManualPaymentError('');
    setPaymentProofFile(null);
    if (!requiresPaymentProof(paymentMethod)) {
      setManualPaymentAccount('');
      return;
    }
    const accounts = selectedPaymentMethod?.accountNumbers || [];
    if (accounts.length === 1) {
      setManualPaymentAccount(accounts[0].number);
    } else {
      setManualPaymentAccount('');
    }
  }, [paymentMethod, selectedPaymentMethod]);

  if (items.length === 0) {
    return (
      <div className="container-app py-20 text-center">
        <p>{t.cart.empty}</p>
        <Link to="/products" className="mt-4 inline-block text-primary-600">
          {language === 'ar' ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }

    if (deliveryMethod === 'scheduled' && !isDateWithinBookingWindow(form.scheduledDate)) {
      setError(language === 'ar' ? 'يرجى اختيار تاريخ توصيل خلال الأسبوع القادم' : 'Please choose a delivery date within the next 7 days');
      return;
    }

    const needsSchedule = deliveryMethod === 'scheduled' || deliveryMethod === 'recurring';
    if (needsSchedule) {
      if (!selectedSlot) {
        setError(language === 'ar' ? 'لا توجد مواعيد توصيل متاحة حالياً' : 'No delivery time slots are currently available');
        return;
      }
      if (!isSlotAvailableForDate({
        dateStr: form.scheduledDate,
        slot: selectedSlot,
        minLeadMinutes: scheduledLeadMinutes,
      })) {
        setError(slotAvailabilityError(language, scheduledLeadMinutes));
        return;
      }
    }

    if (deliveryMethod === 'recurring') {
      if (form.recurringFrequency === 'monthly' && (!form.recurringPreferredDayOfMonth || form.recurringPreferredDayOfMonth > 28)) {
        setError(language === 'ar' ? 'يرجى اختيار يوم من الشهر (1–28)' : 'Please choose a day of the month (1–28)');
        return;
      }
      if (form.recurringFrequency !== 'monthly' && (form.recurringPreferredWeekday == null || form.recurringPreferredWeekday === '')) {
        setError(language === 'ar' ? 'يرجى اختيار يوم التوصيل الدوري' : 'Please choose your recurring delivery day');
        return;
      }
    }

    if (gpsMapEnabled && !hasAddressPin(address)) {
      setError(language === 'ar'
        ? 'يرجى تحديد موقع التوصيل على الخريطة أو البحث عن عنوانك.'
        : 'Please pin your delivery location on the map or search for your address.');
      return;
    }

    if (!address.street?.trim()) {
      setError(language === 'ar' ? 'الشارع مطلوب' : 'Street is required');
      return;
    }

    if (!form.phoneLocal || form.phoneLocal.length < 10) {
      setError(language === 'ar' ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number');
      return;
    }

    if (form.alternatePhoneLocal) {
      if (form.alternatePhoneLocal.length < 10) {
        setError(language === 'ar' ? 'رقم الهاتف البديل غير مكتمل' : 'Alternate phone number is incomplete');
        return;
      }
      if (form.alternatePhoneLocal === form.phoneLocal) {
        setError(language === 'ar' ? 'رقم الهاتف البديل يجب أن يكون مختلفاً عن الرقم الأساسي' : 'Alternate phone must differ from the primary number');
        return;
      }
    }

    if (requiresPaymentProof(paymentMethod)) {
      const accounts = selectedPaymentMethod?.accountNumbers || [];
      if (!accounts.length) {
        setManualPaymentError(language === 'ar'
          ? 'طريقة الدفع غير متاحة حالياً — تواصل مع المتجر'
          : 'This payment method is not available right now');
        return;
      }
      if (!manualPaymentAccount) {
        setManualPaymentError(language === 'ar' ? 'اختر رقم التحويل الذي دفعت إليه' : 'Select the account number you paid to');
        return;
      }
      if (!paymentProofFile) {
        setManualPaymentError(language === 'ar' ? 'ارفع صورة تأكيد التحويل' : 'Upload your transfer confirmation photo');
        return;
      }
    }

    setManualPaymentError('');
    setLoading(true);
    try {
      const scheduledDate = needsSchedule && form.scheduledDate && selectedSlot
        ? getEffectiveSlotStart({
          dateStr: form.scheduledDate,
          slot: selectedSlot,
          minLeadMinutes: scheduledLeadMinutes,
        })
        : undefined;

      await cartService.reserve(items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })), language);

      const orderPayload = {
        lang: language,
        items: items.map((item) => ({
          ...item,
          nameAr: item.name,
        })),
        shippingAddress: {
          label: 'Delivery',
          street: address.street.trim(),
          building: address.building,
          floor: address.floor,
          city: address.city || (language === 'ar' ? location.nameAr : location.nameEn),
          governorate: address.governorate || (language === 'ar' ? location.cityAr : location.cityEn),
          area: address.area || (language === 'ar' ? location.areaAr : location.areaEn),
          postalCode: address.postalCode,
          lat: address.lat,
          lng: address.lng,
          formattedAddress: address.formattedAddress,
          placeId: address.placeId,
          locationSource: address.locationSource || '',
        },
        area: language === 'ar' ? location.areaAr : location.areaEn,
        phone: localToEgyptPhone(form.phoneLocal),
        alternatePhone: form.alternatePhoneLocal
          ? localToEgyptPhone(form.alternatePhoneLocal)
          : undefined,
        notes: form.notes,
        paymentMethod,
        manualPaymentAccount: requiresPaymentProof(paymentMethod) ? manualPaymentAccount : undefined,
        deliveryMethod,
        scheduledDate,
        recurringFrequency: deliveryMethod === 'recurring' ? form.recurringFrequency : undefined,
        recurringPreferredWeekday: deliveryMethod === 'recurring' ? Number(form.recurringPreferredWeekday) : undefined,
        recurringPreferredDayOfMonth: deliveryMethod === 'recurring' ? Number(form.recurringPreferredDayOfMonth) : undefined,
        deliveryZoneId: location.id,
        timeSlotId: selectedSlot?._id,
        discountCode,
        pointsToRedeem: pointsPreview.pointsRedeemed,
      };

      const { data } = requiresPaymentProof(paymentMethod)
        ? await orderService.createWithPaymentProof(orderPayload, paymentProofFile)
        : await orderService.create(orderPayload);

      if (paymentMethod === 'stripe') {
        const { data: paymentData } = await paymentService.createCheckoutSession(data.order.id);
        if (paymentData.url) {
          clearCart();
          window.location.href = paymentData.url;
          return;
        }
        navigate(`/payment?orderId=${data.order.id}`);
      } else {
        clearCart();
        await refreshUser?.();
        navigate('/payment/success', {
          state: {
            orderNumber: data.order.orderNumber,
            total: data.order.total,
            pointsEarned: data.order.pointsEarned || 0,
            cod: true,
          },
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app py-6 md:py-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        <Link to="/" className="transition-colors hover:text-primary-600">{language === 'ar' ? 'الرئيسية' : 'Home'}</Link>
        <span className="text-slate-300">/</span>
        <Link to="/cart" className="transition-colors hover:text-primary-600">{t.nav.cart}</Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-800">{language === 'ar' ? 'إتمام الشراء' : 'Checkout'}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            {language === 'ar' ? 'إتمام الشراء' : 'Checkout'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {language === 'ar'
              ? `${items.length} منتج · راجع التفاصيل ثم أكّد طلبك`
              : `${items.length} product${items.length === 1 ? '' : 's'} · Review details and confirm`}
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-950">
          <span className="mt-0.5 shrink-0 font-bold">!</span>
          <p>
            {language === 'ar' ? 'يجب تسجيل الدخول لإتمام الطلب.' : 'Please login to complete your order.'}{' '}
            <Link to="/login" state={{ from: '/checkout' }} className="font-semibold text-primary-700 underline-offset-2 hover:underline">
              {t.nav.login}
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <form ref={formRef} id="checkout-form" onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
          <CheckoutSection
            step="1"
            title={language === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}
            icon={MapPin}
          >
            <LocationSelector variant="form" className="mb-4" />

            {user?.addresses?.length > 0 && (
              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {language === 'ar' ? 'عنوان محفوظ' : 'Saved address'}
                </span>
                <select
                  value={selectedSavedAddressId}
                  onChange={(e) => applySavedAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                >
                  <option value="">{language === 'ar' ? 'عنوان جديد' : 'New address'}</option>
                  {user.addresses.map((item) => (
                    <option key={item._id} value={item._id}>
                      {[item.street, item.area || item.city].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <AddressMapCapture
              value={address}
              onChange={setAddress}
              deliveryZone={location}
              isAr={language === 'ar'}
              enableMap={gpsMapEnabled}
            />

            <div className="mt-4 space-y-4">
              <PhoneInput
                label={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                value={form.phoneLocal}
                onChange={(phoneLocal) => setForm({ ...form, phoneLocal })}
                required
              />
              <PhoneInput
                label={language === 'ar' ? 'رقم هاتف بديل (اختياري)' : 'Alternate phone (optional)'}
                value={form.alternatePhoneLocal}
                onChange={(alternatePhoneLocal) => setForm({ ...form, alternatePhoneLocal })}
                name="alternatePhone"
              />
              <p className="text-xs text-text-muted">
                {language === 'ar'
                  ? 'رقم إضافي للتواصل عند التوصيل إذا تعذّر الوصول على الرقم الأساسي.'
                  : 'An extra number we can use at delivery if the primary line is unavailable.'}
              </p>
            </div>
          </CheckoutSection>

          <CheckoutSection
            step="2"
            title={language === 'ar' ? 'طريقة التوصيل' : 'Delivery Method'}
            icon={Truck}
          >
            <DeliveryMethodSelector
              deliveryMethod={deliveryMethod}
              onDeliveryMethodChange={setDeliveryMethod}
              form={form}
              onFormChange={patchForm}
              timeSlots={timeSlots}
              language={language}
              subtotal={quotedSubtotal}
              freeDeliveryThreshold={location?.freeDeliveryThreshold ?? 500}
              freeDeliveryMethods={checkoutQuote?.freeDeliveryMethods
                ?? resolveFreeDeliveryMethods(location, {
                  freeDeliveryEnabled: settings?.freeDeliveryEnabled !== false,
                  freeDeliveryMethods: settings?.freeDeliveryMethods,
                })}
              freeDeliveryFromCoupon={
                checkoutQuote?.appliedCoupon?.type === 'free_delivery'
                || appliedCoupon?.type === 'free_delivery'
              }
              scheduledFee={location?.scheduledFee ?? 29.99}
              expressFee={location?.expressFee ?? 49.99}
              expressAvailable={location?.expressAvailable !== false}
              scheduledAvailable={location?.scheduledAvailable !== false}
              bannerSettings={settings?.freeDeliveryBanner}
              storeSettings={settings}
              deliveryZone={location}
            />
          </CheckoutSection>

          <CheckoutSection
            step="3"
            title={language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
            icon={CreditCard}
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(paymentOptions.length ? paymentOptions : [
                { id: 'stripe', labelAr: 'دفع أونلاين (Stripe)', labelEn: 'Online Payment (Stripe)', descriptionAr: 'فيزا / Mastercard / Meeza', descriptionEn: 'Visa / Mastercard / Meeza' },
                { id: 'cod', labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery', descriptionAr: 'ادفع نقداً عند الاستلام', descriptionEn: 'Pay in cash on delivery' },
              ]).map((method) => {
                const selected = paymentMethod === method.id;
                return (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50/80 ring-2 ring-primary-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method.id}
                      checked={selected}
                      onChange={() => setPaymentMethod(method.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-primary-600"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{language === 'ar' ? method.labelAr : method.labelEn}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {language === 'ar' ? method.descriptionAr : method.descriptionEn}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            {requiresPaymentProof(paymentMethod) && selectedPaymentMethod && (
              <ManualTransferPaymentPanel
                method={selectedPaymentMethod}
                isAr={language === 'ar'}
                total={manualTransferTotal}
                selectedAccount={manualPaymentAccount}
                onAccountChange={setManualPaymentAccount}
                proofFile={paymentProofFile}
                onProofChange={setPaymentProofFile}
                error={manualPaymentError}
              />
            )}
          </CheckoutSection>

          <CheckoutSection
            step="4"
            title={language === 'ar' ? 'ملاحظات الطلب' : 'Order Notes'}
            icon={StickyNote}
          >
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder={language === 'ar' ? 'تعليمات إضافية للتوصيل (اختياري)...' : 'Additional delivery instructions (optional)...'}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </CheckoutSection>
        </form>

        <div className="h-fit space-y-3 lg:sticky lg:top-28">
          {discountCode && checkoutQuote && quotedDiscountAmount <= 0 && !quoteLoading && !quoteRefreshing && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {language === 'ar'
                ? 'تعذر تطبيق كود الخصم على هذا الطلب. تحقق من صلاحية الكود أو الحد الأدنى.'
                : 'Could not apply this discount code to the order. Check expiry or minimum order.'}
            </div>
          )}
          <div className={quoteRefreshing ? 'opacity-70 transition-opacity duration-200' : ''}>
            <CheckoutSidebarSummary
              language={language}
              checkoutQuote={checkoutQuote}
              pointsPreview={pointsPreview}
              loyaltyEnabled={!!loyalty?.rules?.enabled}
              loyaltyRules={loyalty?.rules}
              isAuthenticated={isAuthenticated}
              pointsToRedeem={pointsToRedeem}
              onPointsToRedeemChange={setPointsToRedeem}
              deliveryMethod={deliveryMethod}
              location={location}
              form={form}
              selectedSlot={selectedSlot}
              paymentMethod={paymentMethod}
              paymentOptions={paymentOptions}
              totalOverride={pointsPreview.estimatedTotal}
              extraRows={pointsPreview.pointsDiscount > 0 ? [{
                label: language === 'ar' ? 'خصم النقاط' : 'Points discount',
                value: `− ${formatPrice(pointsPreview.pointsDiscount)}`,
                className: 'text-primary-600',
              }] : []}
            />
          </div>
          {quoteLoading && (
            <p className="mt-2 text-center text-xs text-text-muted">
              {language === 'ar' ? 'جاري حساب الإجمالي...' : 'Calculating total...'}
            </p>
          )}
          {quoteRefreshing && !quoteLoading && (
            <p className="mt-2 text-center text-xs text-text-muted">
              {language === 'ar' ? 'جاري تحديث الإجمالي...' : 'Updating total...'}
            </p>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {checkoutPromoNote && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-semibold leading-relaxed text-violet-950">
              {checkoutPromoNote}
            </div>
          )}
          <Button
            type="button"
            className="w-full shadow-md shadow-primary-600/20"
            size="lg"
            disabled={loading || quoteLoading}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {loading ? <Loader size="sm" /> : (language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order')}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
            {language === 'ar' ? 'طلبك محمي — تتبّعه من حسابك بعد التأكيد' : 'Protected order — track from your account'}
          </p>
        </div>
      </div>
    </div>
  );
}
