import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from '../../app/router';
import {
  ArrowLeft, Banknote, Calculator, Check, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Copy, ListChecks, MapPin, MessageCircle, Navigation, Package, Phone,
  Radio, RefreshCw, Ruler, Square, Sun, Timer, User, XCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import { useDriverGeolocation } from '../../hooks/useDriverGeolocation';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { formatPrice } from '../../utils/formatters';
import { formatLocationAge } from '../../utils/orderTracking';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import OsmDeliveryTrackingMap from '../../components/maps/OsmDeliveryTrackingMap';
import DriverStatusBadge from './components/DriverStatusBadge';
import DriverFailModal from './components/DriverFailModal';
import DriverCompleteModal from './components/DriverCompleteModal';
import DriverDeliveryStepper, { computeDeliveryStep } from './components/DriverDeliveryStepper';
import {
  deliveryZoneName,
  formatDeliverySlot,
  formatDistanceKm,
  formatDriverAddress,
  haversineKm,
  itemName,
  mapsDirectionsUrl,
  paymentLabel,
  wazeDirectionsUrl,
  whatsappUrl,
} from './driverUtils';

const TERMINAL_STATUSES = ['delivered', 'delivery_failed'];
const REFRESH_MS = 30000;

function relAgo(iso, isAr) {
  if (!iso) return '';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return isAr ? 'الآن' : 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return isAr ? `منذ ${hrs} س` : `${hrs}h ago`;
}

function CopyButton({ text, isAr, label }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text));
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? (isAr ? 'تم النسخ' : 'Copied') : label}
    </button>
  );
}

export default function DriverDeliveryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(true);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [, setTick] = useState(0);

  const [picked, setPicked] = useLocalStorage(`driver:picked:${id}`, {});
  const [arrivedAt, setArrivedAt] = useLocalStorage(`driver:arrived:${id}`, null);

  const loadOrder = useCallback(async () => {
    try {
      const { data } = await orderService.getDriverDelivery(id);
      setOrder(data.data);
      setLoadError('');
      return data.data;
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadOrder();
  }, [loadOrder]);

  const handleStopped = useCallback(() => {
    setTrackingActive(false);
  }, []);

  const { sharing, error: geoError, lastSent, lastPosition, stop } = useDriverGeolocation(id, {
    enabled: trackingActive,
    orderStatus: order?.orderStatus,
    onStopped: handleStopped,
  });

  const isTerminal = TERMINAL_STATUSES.includes(order?.orderStatus);
  const isTerminalRef = useRef(isTerminal);
  const actionLoadingRef = useRef(actionLoading);
  useEffect(() => { isTerminalRef.current = isTerminal; }, [isTerminal]);
  useEffect(() => { actionLoadingRef.current = actionLoading; }, [actionLoading]);

  useEffect(() => {
    if (order && TERMINAL_STATUSES.includes(order.orderStatus)) {
      setTrackingActive(false);
      stop();
    }
  }, [order?.orderStatus, stop]);

  // Keep the screen on while actively sharing location.
  const wakeLockSupported = useWakeLock(trackingActive);

  // Warn before the tab is closed mid-delivery.
  useEffect(() => {
    if (!trackingActive) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [trackingActive]);

  // Periodic re-render (relative times) + silent status refresh.
  useEffect(() => {
    const iv = setInterval(() => {
      setTick((t) => t + 1);
      if (
        !isTerminalRef.current
        && !actionLoadingRef.current
        && typeof document !== 'undefined'
        && document.visibilityState === 'visible'
      ) {
        loadOrder();
      }
    }, REFRESH_MS);
    return () => clearInterval(iv);
  }, [loadOrder]);

  const addr = order?.shippingAddress;
  const hasMapCoords = addr?.lat != null && addr?.lng != null;
  const canStart = order?.canShareLocation && !isTerminal;
  const canComplete = order?.canComplete && !isTerminal;
  const isCod = order?.paymentMethod === 'cod' && order?.paymentStatus !== 'paid';
  const showPicking = (order?.items?.length || 0) > 0 && order?.pickingChecklistEnabled !== false;
  const showCashCalc = isCod && !isTerminal && order?.cashCalculatorEnabled !== false;
  const slot = formatDeliverySlot(order?.deliveryTimeSlot, isAr);
  const zone = deliveryZoneName(order, isAr);
  const addressText = formatDriverAddress(addr, isAr);

  const driverPin = useMemo(() => {
    if (!lastPosition) return null;
    return { lat: lastPosition.lat, lng: lastPosition.lng };
  }, [lastPosition]);

  const distanceKm = useMemo(() => {
    if (!driverPin || !hasMapCoords) return null;
    return haversineKm(driverPin, { lat: Number(addr.lat), lng: Number(addr.lng) });
  }, [driverPin, hasMapCoords, addr]);

  const step = computeDeliveryStep({
    orderStatus: order?.orderStatus,
    sharing,
    trackingActive,
    arrivedAt,
  });

  const items = order?.items || [];
  const pickedCount = items.reduce((n, _, i) => n + (picked?.[i] ? 1 : 0), 0);
  const allPicked = items.length > 0 && pickedCount === items.length;

  const cashNum = Number(String(cashReceived).replace(/[^\d.]/g, ''));
  const changeDue = Number.isFinite(cashNum) && cashReceived !== ''
    ? cashNum - (order?.total || 0)
    : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrder();
    setRefreshing(false);
  };

  const handleComplete = async (photoFile) => {
    setActionLoading(true);
    setActionError('');
    try {
      const { data } = await orderService.completeDriverDelivery(id, photoFile);
      setOrder(data.data);
      stop();
      setTrackingActive(false);
      setCompleteOpen(false);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFail = async (payload) => {
    setActionLoading(true);
    setActionError('');
    try {
      const { data } = await orderService.failDriverDelivery(id, payload);
      setOrder(data.data);
      setFailOpen(false);
      stop();
      setTrackingActive(false);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="space-y-4">
        <Link to="/driver" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700">
          <ArrowLeft className="h-4 w-4" />
          {isAr ? 'كل الطلبات' : 'All deliveries'}
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError || (isAr ? 'الطلب غير موجود' : 'Delivery not found')}
        </div>
        <Button type="button" variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <Link
          to="/driver"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {isAr ? 'كل الطلبات' : 'All deliveries'}
        </Link>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          aria-label={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Order header */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-4 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-teal-200/80">
                {isAr ? 'رقم الطلب' : 'Order'}
              </p>
              <h1 className="font-mono text-3xl font-bold tabular-nums">#{order.orderNumber}</h1>
              {order.customerName && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-200">
                  <User className="h-4 w-4" aria-hidden />
                  {order.customerName}
                </p>
              )}
            </div>
            <DriverStatusBadge status={order.orderStatus} isAr={isAr} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {slot && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/10">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {slot}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/10">
              <Package className="h-3.5 w-3.5" aria-hidden />
              {order.itemCount || items.length || 0} {isAr ? 'قطعة' : 'items'}
            </span>
            {zone && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/10">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {zone}
              </span>
            )}
            {order.assignedDriverAt && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/10">
                <Timer className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'مُعيّن ' : 'assigned '}{relAgo(order.assignedDriverAt, isAr)}
              </span>
            )}
          </div>
        </div>

        {showCashCalc && (
          <div className="border-b border-amber-200 bg-amber-50">
            <button
              type="button"
              onClick={() => setCashOpen((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-3 text-start"
            >
              <Banknote className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  {isAr ? 'تحصيل عند الاستلام' : 'Collect on delivery'}
                </p>
                <p className="text-xl font-bold tabular-nums text-amber-950">
                  {formatPrice(order.total)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <Calculator className="h-4 w-4" aria-hidden />
                {isAr ? 'حاسبة الباقي' : 'Change'}
                {cashOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {cashOpen && (
              <div className="space-y-3 px-4 pb-4">
                <label className="block text-xs font-medium text-amber-800" htmlFor="cash-received">
                  {isAr ? 'المبلغ المستلم من العميل' : 'Amount received from customer'}
                </label>
                <input
                  id="cash-received"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-lg font-semibold tabular-nums text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(Math.round(order.total)))}
                    className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                  >
                    {isAr ? 'بالضبط' : 'Exact'}
                  </button>
                  {[50, 100, 200, 500].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCashReceived((prev) => String((Number(String(prev).replace(/[^\d.]/g, '')) || 0) + d))}
                      className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-50"
                    >
                      +{d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashReceived('')}
                    className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    {isAr ? 'مسح' : 'Clear'}
                  </button>
                </div>
                {changeDue != null && (
                  <div
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      changeDue < 0
                        ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
                        : 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                    }`}
                  >
                    {changeDue < 0
                      ? (isAr ? `ناقص ${formatPrice(Math.abs(changeDue))}` : `Short by ${formatPrice(Math.abs(changeDue))}`)
                      : (isAr ? `الباقي للعميل: ${formatPrice(changeDue)}` : `Change to return: ${formatPrice(changeDue)}`)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Delivery progress */}
      <section className="rounded-2xl bg-white p-4 pb-3 shadow-sm ring-1 ring-slate-200/80">
        <DriverDeliveryStepper
          step={step}
          failed={order.orderStatus === 'delivery_failed'}
          isAr={isAr}
        />
      </section>

      {/* Map */}
      {hasMapCoords && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-teal-600" aria-hidden />
              {isAr ? 'موقع العميل' : 'Customer location'}
            </h2>
            {distanceKm != null && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                <Ruler className="h-3.5 w-3.5" aria-hidden />
                {formatDistanceKm(distanceKm, isAr)}
              </span>
            )}
          </div>
          <OsmDeliveryTrackingMap
            destination={addr}
            driver={trackingActive ? driverPin : null}
            className="h-52"
            embedded
          />
        </section>
      )}

      {/* Delivery details + navigation */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          {isAr ? 'بيانات التسليم' : 'Delivery details'}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">{addressText}</p>

        <a
          href={mapsDirectionsUrl(addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          <Navigation className="h-4 w-4" aria-hidden />
          {isAr ? 'ملاحة — Google Maps' : 'Navigate — Google Maps'}
        </a>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={wazeDirectionsUrl(addr)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Navigation className="h-4 w-4 text-indigo-600" aria-hidden />
            Waze
          </a>
          <CopyButton text={addressText} isAr={isAr} label={isAr ? 'نسخ العنوان' : 'Copy address'} />
        </div>

        {order.phone && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`tel:${order.phone}`}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-teal-200 bg-teal-50 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-100"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {isAr ? 'اتصال' : 'Call'}
            </a>
            <a
              href={whatsappUrl(order.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          </div>
        )}
        {order.phone && (
          <p className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span dir="ltr" className="font-medium text-slate-700">{order.phone}</span>
            <CopyButton text={order.phone} isAr={isAr} label={isAr ? 'نسخ' : 'Copy'} />
          </p>
        )}
        {order.alternatePhone && (
          <a
            href={`tel:${order.alternatePhone}`}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <Phone className="h-4 w-4" aria-hidden />
            <span dir="ltr">{order.alternatePhone}</span>
            <span className="text-slate-500">· {isAr ? 'هاتف بديل' : 'Alternate'}</span>
          </a>
        )}
        {order.notes && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              {isAr ? 'ملاحظة العميل' : 'Customer note'}
            </p>
            <p className="mt-1">{order.notes}</p>
          </div>
        )}
      </section>

      {/* Order items — picking checklist */}
      {showPicking && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <button
            type="button"
            onClick={() => setItemsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-start"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ListChecks className="h-4 w-4 text-slate-500" aria-hidden />
              {isAr ? 'تجهيز الطلب' : 'Picking list'}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  allPicked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pickedCount}/{items.length}
              </span>
            </span>
            {itemsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <div className="h-1 w-full bg-slate-100">
            <div
              className={`h-full transition-all ${allPicked ? 'bg-emerald-500' : 'bg-teal-500'}`}
              style={{ width: `${items.length ? (pickedCount / items.length) * 100 : 0}%` }}
            />
          </div>

          {itemsOpen && (
            <>
              <div className="flex items-center justify-end gap-2 px-4 pt-2">
                <button
                  type="button"
                  onClick={() => setPicked(allPicked ? {} : Object.fromEntries(items.map((_, i) => [i, true])))}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  {allPicked ? (isAr ? 'إلغاء الكل' : 'Clear all') : (isAr ? 'تحديد الكل' : 'Check all')}
                </button>
              </div>
              <ul className="divide-y divide-slate-100 px-4">
                {items.map((item, idx) => {
                  const on = Boolean(picked?.[idx]);
                  return (
                    <li key={idx}>
                      <label className="flex cursor-pointer items-center gap-3 py-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setPicked((prev) => ({ ...prev, [idx]: !prev?.[idx] }))}
                          className="h-5 w-5 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className={`h-11 w-11 shrink-0 rounded-lg border border-slate-100 object-cover ${on ? 'opacity-50' : ''}`}
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${on ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {itemName(item, isAr)}
                          </p>
                          <p className="text-xs text-slate-500">
                            × {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                          {formatPrice((item.price || 0) * item.quantity)}
                        </p>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Payment summary */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          {isAr ? 'الدفع والإجمالي' : 'Payment & total'}
        </h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</dt>
            <dd className="tabular-nums text-slate-700">{formatPrice(order.subtotal || 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">{isAr ? 'رسوم التوصيل' : 'Delivery fee'}</dt>
            <dd className="tabular-nums text-slate-700">{formatPrice(order.deliveryFee || 0)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500">{isAr ? 'الخصم' : 'Discount'}</dt>
              <dd className="tabular-nums text-emerald-700">− {formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
            <dt className="text-slate-900">{isAr ? 'الإجمالي' : 'Total'}</dt>
            <dd className="tabular-nums text-slate-900">{formatPrice(order.total)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">{paymentLabel(order, isAr)}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              order.paymentStatus === 'paid'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {order.paymentStatus === 'paid'
              ? (isAr ? 'مدفوع' : 'Paid')
              : (isAr ? 'غير مدفوع' : 'Unpaid')}
          </span>
        </div>
      </section>

      {/* Live GPS */}
      {canStart && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Radio className="h-4 w-4 text-violet-600" aria-hidden />
            {isAr ? 'مشاركة الموقع المباشر' : 'Live GPS sharing'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'يُرى موقعك على خريطة العميل والإدارة كل ~20 ثانية.'
              : 'Your location appears on the customer and admin maps (~every 20s).'}
          </p>

          {!trackingActive ? (
            <Button
              type="button"
              className="mt-4 w-full bg-violet-600 hover:bg-violet-700"
              onClick={() => setTrackingActive(true)}
            >
              <Radio className="h-4 w-4" aria-hidden />
              {isAr ? 'بدء التوصيل' : 'Start delivery'}
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                </span>
                {sharing
                  ? (isAr ? 'جاري مشاركة الموقع…' : 'Sharing location…')
                  : (isAr ? 'جاري التفعيل…' : 'Starting…')}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {lastSent && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {isAr ? 'آخر تحديث ' : 'Updated '}
                    {formatLocationAge(lastSent, isAr)}
                  </span>
                )}
                {distanceKm != null && (
                  <span className="inline-flex items-center gap-1">
                    <Ruler className="h-3.5 w-3.5" aria-hidden />
                    {formatDistanceKm(distanceKm, isAr)} {isAr ? 'للعميل' : 'to customer'}
                  </span>
                )}
                {wakeLockSupported && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Sun className="h-3.5 w-3.5" aria-hidden />
                    {isAr ? 'الشاشة تبقى مضاءة' : 'Screen stays on'}
                  </span>
                )}
              </div>
              {geoError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{geoError}</p>
              )}
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  stop();
                  setTrackingActive(false);
                }}
              >
                <Square className="h-4 w-4" aria-hidden />
                {isAr ? 'إيقاف المشاركة' : 'Stop sharing'}
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Arrival marker */}
      {canComplete && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-teal-600" aria-hidden />
            {isAr ? 'الوصول للعميل' : 'Arrival'}
          </h2>
          {arrivedAt ? (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {isAr ? 'وصلت ' : 'Arrived '}
                {new Date(arrivedAt).toLocaleTimeString(isAr ? 'ar-EG' : undefined, { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {isAr ? 'انتظار ' : 'waiting '}{relAgo(arrivedAt, isAr)}
              </p>
              <button
                type="button"
                onClick={() => setArrivedAt(null)}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                {isAr ? 'تراجع' : 'Undo'}
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => setArrivedAt(new Date().toISOString())}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {isAr ? 'وصلت إلى موقع العميل' : "I've arrived at the customer"}
            </Button>
          )}
        </section>
      )}

      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      )}

      {/* Terminal states */}
      {order.orderStatus === 'delivered' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" aria-hidden />
          <p className="font-semibold text-emerald-900">
            {isAr ? 'تم تسليم الطلب بنجاح' : 'Order delivered successfully'}
          </p>
          {order.deliveryProofPhoto && (
            <img
              src={order.deliveryProofPhoto}
              alt={isAr ? 'إثبات التسليم' : 'Proof of delivery'}
              className="mx-auto mt-4 h-40 w-full max-w-xs rounded-xl object-cover ring-1 ring-emerald-200"
            />
          )}
          <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/driver')}>
            {isAr ? 'العودة للطلبات' : 'Back to deliveries'}
          </Button>
        </div>
      )}

      {order.orderStatus === 'delivery_failed' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <XCircle className="mx-auto mb-2 h-10 w-10 text-red-600" aria-hidden />
          <p className="font-semibold text-red-900">
            {isAr ? 'تم تسجيل فشل التسليم' : 'Delivery failure recorded'}
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/driver')}>
            {isAr ? 'العودة للطلبات' : 'Back to deliveries'}
          </Button>
        </div>
      )}

      {/* Sticky actions */}
      {canComplete && (
        <div className="sticky bottom-20 z-20 -mx-4 space-y-2 rounded-t-2xl border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
          {showPicking && !allPicked && (
            <p className="text-center text-xs font-medium text-amber-700">
              {isAr
                ? `${items.length - pickedCount} صنف لم يُجهَّز بعد`
                : `${items.length - pickedCount} item(s) not picked yet`}
            </p>
          )}
          <Button
            type="button"
            className="w-full bg-emerald-600 py-3 text-base hover:bg-emerald-700"
            onClick={() => setCompleteOpen(true)}
            disabled={actionLoading}
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            {isCod
              ? (isAr ? `تم التسليم — تحصيل ${formatPrice(order.total)}` : `Delivered — collect ${formatPrice(order.total)}`)
              : (isAr ? 'تم التسليم' : 'Mark delivered')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setFailOpen(true)}
            disabled={actionLoading}
          >
            <XCircle className="h-4 w-4" aria-hidden />
            {isAr ? 'تعذّر التسليم' : 'Could not deliver'}
          </Button>
        </div>
      )}

      <DriverFailModal
        open={failOpen}
        isAr={isAr}
        loading={actionLoading}
        onClose={() => setFailOpen(false)}
        onConfirm={handleFail}
      />
      <DriverCompleteModal
        open={completeOpen}
        isAr={isAr}
        loading={actionLoading}
        isCod={isCod}
        total={order.total}
        onClose={() => setCompleteOpen(false)}
        onConfirm={handleComplete}
      />
    </div>
  );
}
