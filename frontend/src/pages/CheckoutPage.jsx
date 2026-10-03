import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from '../app/router';
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard,
  MapPin, Pencil, ShieldCheck, Truck,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatters';
import { cartService, loyaltyService, orderService, paymentService, walletService } from '../services/apiServices';
import PhoneInput from '../components/ui/PhoneInput';
import LocationSelector from '../components/layout/LocationSelector';
import AddressMapCapture from '../components/maps/AddressMapCapture';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Loader from '../components/ui/Loader';
import { emptyAddressCapture, hasAddressPin, normalizeGpsAddress } from '../utils/parseGooglePlace';
import { isGpsDeliveryEnabled } from '../utils/gpsDelivery';
import { deliveryLocationLabel } from '../utils/locationGate';
import CheckoutSidebarSummary from '../components/checkout/CheckoutSidebarSummary';
import DeliveryMethodSelector, { resolveSelectedSlot } from '../components/checkout/DeliveryMethodSelector';
import { DELIVERY_METHODS, defaultBookingDate, isDateWithinBookingWindow } from '../constants/deliveryOptions';
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

function CheckoutSection({ title, children }) {
  return (
    <section>
      {title && <h2 className="mb-2 text-sm font-bold text-slate-800">{title}</h2>}
      {children}
    </section>
  );
}

function CheckoutStepper({ steps, currentStep, maxStepReached, onStepClick, isAr }) {
  const activeLabel = steps.find((s) => s.id === currentStep)?.label;
  return (
    <div>
      <ol className="flex items-center">
        {steps.map((s, idx) => {
          const isCompleted = s.id < currentStep;
          const isActive = s.id === currentStep;
          const clickable = s.id <= maxStepReached && s.id !== currentStep;
          const Icon = s.icon;
          return (
            <li key={s.id} className={`flex items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`}>
              <button
                type="button"
                onClick={() => clickable && onStepClick(s.id)}
                disabled={!clickable}
                aria-current={isActive ? 'step' : undefined}
                aria-label={s.label}
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200',
                  isCompleted ? 'bg-primary-600 text-white' : '',
                  isActive ? 'border-2 border-primary-600 bg-white text-primary-700 shadow-sm ring-4 ring-primary-100' : '',
                  !isCompleted && !isActive ? 'border border-slate-200 bg-slate-100 text-slate-400' : '',
                  clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                ].join(' ')}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden /> : (Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : s.id)}
              </button>
              {idx < steps.length - 1 && (
                <div className={`mx-1.5 h-0.5 flex-1 rounded transition-colors duration-300 ${s.id < currentStep ? 'bg-primary-600' : 'bg-slate-200'}`} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-xs font-semibold text-slate-800 sm:text-sm">
        {isAr ? `الخطوة ${currentStep} من ${steps.length} — ` : `Step ${currentStep} of ${steps.length} — `}
        <span className="text-primary-700">{activeLabel}</span>
      </p>
    </div>
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
  const {
    location, refetchZones, confirmed: locationConfirmed,
    pin: locationPin, manualAddress: locationManualAddress, openGate,
  } = useLocation();
  const { settings } = useStoreSettings();
  const gpsMapEnabled = isGpsDeliveryEnabled(settings);
  const { isAuthenticated, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const checkoutPromoNote = useMemo(
    () => getCheckoutPromoReassurance(items, isAr),
    [items, isAr],
  );
  // The customer's own pinned/typed address — shown in the summary recap instead
  // of the admin zone label (see deliveryLocationLabel / delivery-zone display rules).
  const deliverToLabel = deliveryLocationLabel(
    locationConfirmed ? locationPin : null,
    isAr ? location?.nameAr : location?.nameEn,
    isAr,
    locationConfirmed ? locationManualAddress : null,
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
  const [walletToRedeem, setWalletToRedeem] = useState('');
  const [wallet, setWallet] = useState(null);
  const [address, setAddress] = useState(emptyAddressCapture);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [showAlternatePhone, setShowAlternatePhone] = useState(false);
  const STEPS = useMemo(() => ([
    { id: 1, label: language === 'ar' ? 'العنوان' : 'Address', icon: MapPin },
    { id: 2, label: language === 'ar' ? 'التوصيل' : 'Delivery', icon: Truck },
    { id: 3, label: language === 'ar' ? 'الدفع' : 'Payment', icon: CreditCard },
    { id: 4, label: language === 'ar' ? 'المراجعة' : 'Review', icon: Check },
  ]), [language]);
  // A precise pin dropped in the startup location popup — the customer already
  // told us where to deliver, so checkout confirms it instead of asking again.
  const hasGatePin = locationConfirmed && locationPin?.lat != null && locationPin?.lng != null;
  const showAddressEditor = !hasGatePin;
  const gateSummaryLabel = deliveryLocationLabel(
    locationPin,
    language === 'ar' ? location?.nameAr : location?.nameEn,
    language === 'ar',
    locationManualAddress,
  );
  // Same formula the final review step uses — keeps the two in sync so an edited
  // street never "reverts" to the original pin label once the editor is closed.
  const addressSummaryLabel = address.street?.trim() || address.formattedAddress?.trim() || gateSummaryLabel;
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

  // A location picked in the startup popup is the default delivery point — its pin
  // flows to the order so admin/driver see the customer's exact GPS spot. Tracked by
  // a content key (not a one-shot flag) so re-picking a location via "Change location"
  // re-applies the new pin instead of silently keeping the stale address.
  const lastAppliedPinKeyRef = useRef(null);
  useEffect(() => {
    if (!locationConfirmed || locationPin?.lat == null || locationPin?.lng == null) return;
    const pinKey = `${locationPin.lat},${locationPin.lng},${locationPin.formattedAddress || ''}`;
    if (lastAppliedPinKeyRef.current === pinKey) return;
    lastAppliedPinKeyRef.current = pinKey;
    setAddress((prev) => {
      const next = {
        ...prev,
        lat: locationPin.lat,
        lng: locationPin.lng,
        formattedAddress: locationPin.formattedAddress || prev.formattedAddress || '',
        area: prev.area || (language === 'ar' ? location?.areaAr : location?.areaEn) || '',
        city: prev.city || (language === 'ar' ? location?.cityAr : location?.cityEn) || '',
        locationSource: locationPin.source === 'gps' ? 'gps' : 'map',
        gpsConfirmed: true,
      };
      // Derive a usable street line from the pinned address so the shopper does
      // not have to retype what the popup already resolved.
      next.street = normalizeGpsAddress(next).street || next.formattedAddress || '';
      return next;
    });
    setSelectedSavedAddressId('');
  }, [locationConfirmed, locationPin, language, location?.areaAr, location?.areaEn, location?.cityAr, location?.cityEn]);

  // An address typed via "إدخال يدوي" in the startup popup — no pin, but real
  // street/city details that should pre-fill the checkout form. Same content-key
  // tracking so re-typing a manual address in the popup re-applies it here too.
  const lastAppliedManualKeyRef = useRef(null);
  useEffect(() => {
    if (locationPin?.lat != null) return; // the pin flow above owns the address in that case
    if (!locationConfirmed || !locationManualAddress?.street) return;
    const manualKey = JSON.stringify(locationManualAddress);
    if (lastAppliedManualKeyRef.current === manualKey) return;
    lastAppliedManualKeyRef.current = manualKey;
    setAddress((prev) => ({
      ...prev,
      street: locationManualAddress.street || prev.street,
      building: locationManualAddress.building || prev.building,
      floor: locationManualAddress.floor || prev.floor,
      city: locationManualAddress.city || prev.city,
      governorate: locationManualAddress.governorate || prev.governorate,
      area: locationManualAddress.area || prev.area,
      formattedAddress: locationManualAddress.formattedAddress || prev.formattedAddress || '',
      locationSource: 'manual',
    }));
    setSelectedSavedAddressId('');
  }, [locationConfirmed, locationManualAddress, locationPin?.lat]);

  useEffect(() => {
    if (!user?.addresses?.length) return;
    // Don't override a fresh popup pin with the default saved address.
    if (locationConfirmed && locationPin?.lat != null && !lastAppliedPinKeyRef.current) return;
    if (lastAppliedPinKeyRef.current || lastAppliedManualKeyRef.current) return;
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
  }, [user?.addresses, locationConfirmed, locationPin?.lat]);

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
      walletToRedeem: isAuthenticated ? Math.max(0, Number(walletToRedeem) || 0) : 0,
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
  }, [items, deliveryMethod, discountCode, location?.id, isAuthenticated, pointsToRedeem, walletToRedeem]);

  const quotedSubtotal = checkoutQuote?.subtotal ?? subtotal;
  const quotedDiscountAmount = checkoutQuote?.discountAmount ?? discountAmount;
  const quotedTotal = checkoutQuote?.totalBeforeWallet ?? checkoutQuote?.total ?? total;

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
    walletService.getMe(language)
      .then(({ data }) => {
        if (mounted) setWallet(data);
      })
      .catch(() => {
        if (mounted) setWallet(null);
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

  const walletPreview = useMemo(() => {
    const rules = wallet?.settings || settings?.wallet || {};
    const enabled = rules.enabled !== false && rules.allowCheckoutSpend !== false;
    const balance = Math.max(0, Number(wallet?.walletBalance ?? user?.walletBalance ?? 0));
    // Total after points, before wallet — points preview already nets points out.
    const afterPoints = Math.max(0, Number(pointsPreview.estimatedTotal ?? quotedTotal));
    const serverApplied = Math.max(0, Number(checkoutQuote?.walletApplied || 0));
    const requested = Math.max(0, Number(walletToRedeem) || 0);
    const percent = Number(rules.maxCheckoutPercent ?? 100);
    const percentCap = percent > 0 ? Math.round(afterPoints * (percent / 100) * 100) / 100 : afterPoints;
    const applied = !enabled || requested <= 0
      ? 0
      : Math.round(Math.min(serverApplied || requested, requested, balance, afterPoints, percentCap) * 100) / 100;
    const estimatedTotal = Math.max(0, Math.round((afterPoints - applied) * 100) / 100);
    return { enabled, balance, rules, walletApplied: applied, estimatedTotal, payableTotal: afterPoints };
  }, [wallet, settings?.wallet, pointsPreview.estimatedTotal, quotedTotal, checkoutQuote?.walletApplied, walletToRedeem, user?.walletBalance]);

  const manualTransferTotal = walletPreview.estimatedTotal ?? pointsPreview.estimatedTotal ?? checkoutQuote?.total ?? total;

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

  const needsSchedule = deliveryMethod === 'scheduled' || deliveryMethod === 'recurring';

  const validateAddressStep = () => {
    if (gpsMapEnabled && !hasAddressPin(address) && address.locationSource !== 'manual') {
      return language === 'ar'
        ? 'يرجى تحديد موقع التوصيل على الخريطة أو البحث عن عنوانك.'
        : 'Please pin your delivery location on the map or search for your address.';
    }
    const resolvedStreet = address.street?.trim() || address.formattedAddress?.trim() || '';
    if (!resolvedStreet) {
      return language === 'ar'
        ? 'يرجى تحديد عنوان التوصيل على الخريطة أو إدخال اسم الشارع.'
        : 'Please pin your delivery address or enter a street name.';
    }
    if (!form.phoneLocal || form.phoneLocal.length < 10) {
      return language === 'ar' ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number';
    }
    if (form.alternatePhoneLocal) {
      if (form.alternatePhoneLocal.length < 10) {
        return language === 'ar' ? 'رقم الهاتف البديل غير مكتمل' : 'Alternate phone number is incomplete';
      }
      if (form.alternatePhoneLocal === form.phoneLocal) {
        return language === 'ar' ? 'رقم الهاتف البديل يجب أن يكون مختلفاً عن الرقم الأساسي' : 'Alternate phone must differ from the primary number';
      }
    }
    return '';
  };

  const validateDeliveryStep = () => {
    if (deliveryMethod === 'scheduled' && !isDateWithinBookingWindow(form.scheduledDate)) {
      return language === 'ar' ? 'يرجى اختيار تاريخ توصيل خلال الأسبوع القادم' : 'Please choose a delivery date within the next 7 days';
    }
    if (needsSchedule) {
      if (!selectedSlot) {
        return language === 'ar' ? 'لا توجد مواعيد توصيل متاحة حالياً' : 'No delivery time slots are currently available';
      }
      if (!isSlotAvailableForDate({
        dateStr: form.scheduledDate,
        slot: selectedSlot,
        minLeadMinutes: scheduledLeadMinutes,
      })) {
        return slotAvailabilityError(language, scheduledLeadMinutes);
      }
    }
    if (deliveryMethod === 'recurring') {
      if (form.recurringFrequency === 'monthly' && (!form.recurringPreferredDayOfMonth || form.recurringPreferredDayOfMonth > 28)) {
        return language === 'ar' ? 'يرجى اختيار يوم من الشهر (1–28)' : 'Please choose a day of the month (1–28)';
      }
      if (form.recurringFrequency !== 'monthly' && (form.recurringPreferredWeekday == null || form.recurringPreferredWeekday === '')) {
        return language === 'ar' ? 'يرجى اختيار يوم التوصيل الدوري' : 'Please choose your recurring delivery day';
      }
    }
    return '';
  };

  const validatePaymentStep = () => {
    if (requiresPaymentProof(paymentMethod)) {
      const accounts = selectedPaymentMethod?.accountNumbers || [];
      if (!accounts.length) {
        setManualPaymentError(language === 'ar'
          ? 'طريقة الدفع غير متاحة حالياً — تواصل مع المتجر'
          : 'This payment method is not available right now');
        return false;
      }
      if (!manualPaymentAccount) {
        setManualPaymentError(language === 'ar' ? 'اختر رقم التحويل الذي دفعت إليه' : 'Select the account number you paid to');
        return false;
      }
      if (!paymentProofFile) {
        setManualPaymentError(language === 'ar' ? 'ارفع صورة تأكيد التحويل' : 'Upload your transfer confirmation photo');
        return false;
      }
    }
    setManualPaymentError('');
    return true;
  };

  const scrollToStepTop = () => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      const err = validateAddressStep();
      if (err) { setError(err); return; }
    } else if (step === 2) {
      const err = validateDeliveryStep();
      if (err) { setError(err); return; }
    } else if (step === 3) {
      if (!validatePaymentStep()) return;
    }
    setMaxStepReached((m) => Math.max(m, step + 1));
    setStep((s) => Math.min(STEPS.length, s + 1));
    scrollToStepTop();
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
    scrollToStepTop();
  };

  const goToStep = (n) => {
    if (n > maxStepReached) return;
    setError('');
    setStep(n);
    scrollToStepTop();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step < STEPS.length) {
      handleNext();
      return;
    }

    setError('');

    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }

    const addressErr = validateAddressStep();
    if (addressErr) { setError(addressErr); setStep(1); return; }

    const deliveryErr = validateDeliveryStep();
    if (deliveryErr) { setError(deliveryErr); setStep(2); return; }

    if (!validatePaymentStep()) { setStep(3); return; }

    const resolvedStreet = address.street?.trim() || address.formattedAddress?.trim() || '';

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
          street: resolvedStreet,
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
        walletToRedeem: walletPreview.walletApplied,
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
    <div className="container-app py-3">
      <h1 className="sr-only">{language === 'ar' ? 'إتمام الشراء' : 'Checkout'}</h1>

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

      <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <CheckoutStepper
            steps={STEPS}
            currentStep={step}
            maxStepReached={maxStepReached}
            onStepClick={goToStep}
            isAr={isAr}
          />
        </div>

        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-3 p-3 sm:p-4">
          {step === 1 && (
          <CheckoutSection>
            {locationConfirmed ? (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
                      {language === 'ar' ? 'عنوان التوصيل' : 'Delivery address'}
                    </p>
                    <p className="mt-0.5 break-words text-sm font-medium text-emerald-900">
                      {addressSummaryLabel}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-emerald-200/70 pt-2">
                  <button
                    type="button"
                    onClick={openGate}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100/60"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {language === 'ar' ? 'تغيير الموقع' : 'Change location'}
                  </button>
                </div>
              </div>
            ) : (
              <LocationSelector variant="form" className="mb-3" />
            )}

            {hasGatePin && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <Input
                  label={language === 'ar' ? 'رقم العمارة' : 'Building'}
                  value={address.building || ''}
                  onChange={(e) => setAddress((prev) => ({ ...prev, building: e.target.value }))}
                  placeholder={language === 'ar' ? 'مثال: 12' : 'e.g. 12'}
                />
                <Input
                  label={language === 'ar' ? 'الدور / الشقة' : 'Floor / Apt'}
                  value={address.floor || ''}
                  onChange={(e) => setAddress((prev) => ({ ...prev, floor: e.target.value }))}
                  placeholder={language === 'ar' ? 'مثال: الدور 3 - شقة 5' : 'e.g. Floor 3, Apt 5'}
                />
              </div>
            )}

            {showAddressEditor && user?.addresses?.length > 0 && (
              <label className="mb-3 block">
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

            {showAddressEditor && (
              <AddressMapCapture
                value={address}
                onChange={setAddress}
                deliveryZone={location}
                isAr={language === 'ar'}
                enableMap={gpsMapEnabled}
              />
            )}

            <div className="mt-2 space-y-2">
              <PhoneInput
                label={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                value={form.phoneLocal}
                onChange={(phoneLocal) => setForm({ ...form, phoneLocal })}
                required
              />
              {showAlternatePhone || form.alternatePhoneLocal ? (
                <div>
                  <PhoneInput
                    label={language === 'ar' ? 'رقم هاتف بديل (اختياري)' : 'Alternate phone (optional)'}
                    value={form.alternatePhoneLocal}
                    onChange={(alternatePhoneLocal) => setForm({ ...form, alternatePhoneLocal })}
                    name="alternatePhone"
                  />
                  <p className="mt-1.5 text-xs text-text-muted">
                    {language === 'ar'
                      ? 'رقم إضافي للتواصل عند التوصيل إذا تعذّر الوصول على الرقم الأساسي.'
                      : 'An extra number we can use at delivery if the primary line is unavailable.'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAlternatePhone(true)}
                  className="text-sm font-semibold text-primary-700 hover:text-primary-800"
                >
                  {language === 'ar' ? '+ إضافة رقم هاتف آخر' : '+ Add another phone number'}
                </button>
              )}
            </div>
          </CheckoutSection>
          )}

          {step === 2 && (
          <CheckoutSection>
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
          )}

          {step === 3 && (
          <CheckoutSection>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {(paymentOptions.length ? paymentOptions : [
                { id: 'stripe', labelAr: 'دفع أونلاين (Stripe)', labelEn: 'Online Payment (Stripe)', descriptionAr: 'فيزا / Mastercard / Meeza', descriptionEn: 'Visa / Mastercard / Meeza' },
                { id: 'cod', labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery', descriptionAr: 'ادفع نقداً عند الاستلام', descriptionEn: 'Pay in cash on delivery' },
              ]).map((method) => {
                const selected = paymentMethod === method.id;
                return (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition-all sm:gap-3 sm:p-3 ${
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
                      <p className="text-sm font-semibold text-slate-900 sm:text-base">{language === 'ar' ? method.labelAr : method.labelEn}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs sm:leading-relaxed">
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
          )}

          {step === 4 && (
            <CheckoutSection>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {language === 'ar' ? 'عنوان التوصيل' : 'Delivery address'}
                      </p>
                      <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">
                        {address.street?.trim() || address.formattedAddress?.trim() || deliverToLabel}
                      </p>
                      {(address.building || address.floor) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[address.building && `${language === 'ar' ? 'عمارة' : 'Bldg'} ${address.building}`, address.floor]
                            .filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
                        {localToEgyptPhone(form.phoneLocal)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    {language === 'ar' ? 'تعديل' : 'Edit'}
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {language === 'ar' ? 'طريقة التوصيل' : 'Delivery method'}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {language === 'ar'
                          ? DELIVERY_METHODS[deliveryMethod]?.labelAr || deliveryMethod
                          : DELIVERY_METHODS[deliveryMethod]?.labelEn || deliveryMethod}
                      </p>
                      {selectedSlot && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {form.scheduledDate} · {language === 'ar' ? selectedSlot.labelAr : selectedSlot.labelEn}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    {language === 'ar' ? 'تعديل' : 'Edit'}
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {language === 'ar' ? 'طريقة الدفع' : 'Payment method'}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {language === 'ar' ? selectedPaymentMethod?.labelAr : selectedPaymentMethod?.labelEn}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    {language === 'ar' ? 'تعديل' : 'Edit'}
                  </button>
                </div>
              </div>
            </CheckoutSection>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:pt-4">
            {step > 1 ? (
              <Button type="button" variant="outline" size="lg" onClick={handleBack} className="gap-1.5 !px-4 sm:!px-7">
                {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
                {language === 'ar' ? 'رجوع' : 'Back'}
              </Button>
            ) : <span />}
            <div className="flex items-center gap-2.5">
              <div className="flex shrink-0 flex-col items-end leading-tight">
                <span className="text-[11px] font-medium text-slate-500">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                </span>
                <span className="text-lg font-extrabold text-primary-700 tabular-nums" dir="ltr">
                  {formatPrice(walletPreview.estimatedTotal)}
                </span>
              </div>
              <Button type="submit" size="lg" disabled={loading || quoteLoading} className="gap-1.5 !px-4 shadow-md shadow-primary-600/20 sm:!px-7">
                {loading
                  ? <Loader size="sm" />
                  : step < STEPS.length
                    ? (language === 'ar' ? 'التالي' : 'Next')
                    : (language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order')}
                {!loading && step < STEPS.length && (isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />)}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <span>{language === 'ar' ? 'عرض تفاصيل الطلب والسلة' : 'View order & cart details'}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${summaryOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <div className={`${summaryOpen ? 'block' : 'hidden'} space-y-3`}>
          {step === STEPS.length && (
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder={language === 'ar' ? 'تعليمات إضافية للتوصيل (اختياري)...' : 'Additional delivery instructions (optional)...'}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          )}
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
              loyaltyEnabled={(loyalty?.rules?.enabled ?? settings?.loyalty?.enabled) !== false}
              loyaltyRules={loyalty?.rules || settings?.loyalty}
              isAuthenticated={isAuthenticated}
              pointsToRedeem={pointsToRedeem}
              onPointsToRedeemChange={setPointsToRedeem}
              walletEnabled={walletPreview.enabled}
              walletBalance={walletPreview.balance}
              walletSettings={walletPreview.rules}
              walletToRedeem={walletToRedeem}
              onWalletToRedeemChange={setWalletToRedeem}
              walletApplied={walletPreview.walletApplied}
              walletPayableTotal={walletPreview.payableTotal}
              deliveryMethod={deliveryMethod}
              location={location}
              deliverToLabel={deliverToLabel}
              form={form}
              selectedSlot={selectedSlot}
              paymentMethod={paymentMethod}
              paymentOptions={paymentOptions}
              totalOverride={walletPreview.estimatedTotal}
              extraRows={[
                ...(pointsPreview.pointsDiscount > 0 ? [{
                  label: language === 'ar' ? 'خصم النقاط' : 'Points discount',
                  value: `− ${formatPrice(pointsPreview.pointsDiscount)}`,
                  className: 'text-primary-600',
                }] : []),
                ...(walletPreview.walletApplied > 0 ? [{
                  label: language === 'ar' ? 'المحفظة' : 'Wallet',
                  value: `− ${formatPrice(walletPreview.walletApplied)}`,
                  className: 'text-primary-600',
                }] : []),
              ]}
              hideFreeDeliveryBar={step === STEPS.length}
              hideDeliveryMeta={step === STEPS.length}
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
          </div>
          {checkoutPromoNote && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-semibold leading-relaxed text-violet-950">
              {checkoutPromoNote}
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
            {language === 'ar' ? 'طلبك محمي — تتبّعه من حسابك بعد التأكيد' : 'Protected order — track from your account'}
          </p>
      </div>
      </div>
    </div>
  );
}
