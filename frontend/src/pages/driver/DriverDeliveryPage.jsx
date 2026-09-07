import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Banknote, CheckCircle2, ChevronDown, ChevronUp, Clock,
  MapPin, Navigation, Package, Phone, Radio, Square, User, XCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import { useDriverGeolocation } from '../../hooks/useDriverGeolocation';
import { formatPrice } from '../../utils/formatters';
import { formatLocationAge } from '../../utils/orderTracking';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import OsmDeliveryTrackingMap from '../../components/maps/OsmDeliveryTrackingMap';
import DriverStatusBadge from './components/DriverStatusBadge';
import DriverFailModal from './components/DriverFailModal';
import {
  formatDeliverySlot,
  formatDriverAddress,
  itemName,
  mapsDirectionsUrl,
  paymentLabel,
} from './driverUtils';

const TERMINAL_STATUSES = ['delivered', 'delivery_failed'];

export default function DriverDeliveryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [trackingActive, setTrackingActive] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [actionError, setActionError] = useState('');

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

  useEffect(() => {
    if (order && TERMINAL_STATUSES.includes(order.orderStatus)) {
      setTrackingActive(false);
      stop();
    }
  }, [order?.orderStatus, stop]);

  const addr = order?.shippingAddress;
  const hasMapCoords = addr?.lat != null && addr?.lng != null;
  const isTerminal = TERMINAL_STATUSES.includes(order?.orderStatus);
  const canStart = order?.canShareLocation && !isTerminal;
  const canComplete = order?.canComplete && !isTerminal;
  const isCod = order?.paymentMethod === 'cod' && order?.paymentStatus !== 'paid';
  const slot = formatDeliverySlot(order?.deliveryTimeSlot, isAr);

  const driverPin = useMemo(() => {
    if (!lastPosition) return null;
    return { lat: lastPosition.lat, lng: lastPosition.lng };
  }, [lastPosition]);

  const handleComplete = async () => {
    const msg = isCod
      ? (isAr
        ? `تأكيد تسليم الطلب وتحصيل ${formatPrice(order.total)} نقداً؟`
        : `Confirm delivery and collect ${formatPrice(order.total)} cash?`)
      : (isAr ? 'تأكيد تسليم الطلب؟' : 'Confirm order delivered?');
    if (!window.confirm(msg)) return;

    setActionLoading(true);
    setActionError('');
    try {
      const { data } = await orderService.completeDriverDelivery(id);
      setOrder(data.data);
      stop();
      setTrackingActive(false);
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
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <Link
        to="/driver"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {isAr ? 'كل الطلبات' : 'All deliveries'}
      </Link>

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
              {order.itemCount || order.items?.length || 0} {isAr ? 'قطعة' : 'items'}
            </span>
          </div>
        </div>

        {isCod && !isTerminal && (
          <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
            <Banknote className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {isAr ? 'تحصيل عند الاستلام' : 'Collect on delivery'}
              </p>
              <p className="text-xl font-bold tabular-nums text-amber-950">
                {formatPrice(order.total)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Map */}
      {hasMapCoords && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-teal-600" aria-hidden />
              {isAr ? 'موقع العميل' : 'Customer location'}
            </h2>
          </div>
          <OsmDeliveryTrackingMap
            destination={addr}
            driver={trackingActive ? driverPin : null}
            className="h-52"
            embedded
          />
          <div className="p-3">
            <a
              href={mapsDirectionsUrl(addr)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              {isAr ? 'بدء الملاحة — Google Maps' : 'Start navigation — Google Maps'}
            </a>
          </div>
        </section>
      )}

      {/* Customer contact */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          {isAr ? 'بيانات التسليم' : 'Delivery details'}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          {formatDriverAddress(addr, isAr)}
        </p>
        {order.phone && (
          <a
            href={`tel:${order.phone}`}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-teal-200 bg-teal-50 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            <Phone className="h-4 w-4" aria-hidden />
            <span dir="ltr">{order.phone}</span>
            <span className="text-teal-600">· {isAr ? 'اتصال' : 'Call'}</span>
          </a>
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

      {/* Order items */}
      {order.items?.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <button
            type="button"
            onClick={() => setItemsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-start"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Package className="h-4 w-4 text-slate-500" aria-hidden />
              {isAr ? 'محتويات الطلب' : 'Order items'}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {order.items.length}
              </span>
            </span>
            {itemsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {itemsOpen && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 px-4">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 py-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {itemName(item, isAr)}
                    </p>
                    <p className="text-xs text-slate-500">
                      × {item.quantity}
                      {item.unit ? ` ${item.unit}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                    {formatPrice((item.price || 0) * item.quantity)}
                  </p>
                </li>
              ))}
              <li className="flex justify-between py-3 text-sm">
                <span className="text-slate-500">{paymentLabel(order, isAr)}</span>
                <span className="font-bold tabular-nums text-slate-900">{formatPrice(order.total)}</span>
              </li>
            </ul>
          )}
        </section>
      )}

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
              {lastSent && (
                <p className="text-xs text-slate-500">
                  {isAr ? 'آخر تحديث: ' : 'Last update: '}
                  {new Date(lastSent).toLocaleTimeString(isAr ? 'ar-EG' : undefined)}
                  {' · '}
                  {formatLocationAge(lastSent, isAr)}
                </p>
              )}
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
          <Button
            type="button"
            className="w-full bg-emerald-600 py-3 text-base hover:bg-emerald-700"
            onClick={handleComplete}
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
    </div>
  );
}
