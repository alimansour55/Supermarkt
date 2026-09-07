import { useEffect, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { orderService } from '../../services/apiServices';
import TrackingMapView from './TrackingMapView';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import { formatEta, formatLocationAge } from '../../utils/orderTracking';

const POLL_MS = 90_000;

export default function OrderTrackingPanel({ orderId, isAr, open, onClose }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await orderService.getTracking(orderId);
      setSnapshot(data.data);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر تحميل التتبع' : 'Could not load tracking'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !orderId) return undefined;

    load();
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [open, orderId]);

  if (!open) return null;

  const etaLabel = snapshot?.mapVisible !== false && snapshot?.route?.etaText
    ? snapshot.route.etaText
    : (snapshot?.mapVisible !== false && snapshot?.estimatedDeliveryAt
      ? formatEta(snapshot.estimatedDeliveryAt, isAr)
      : '');

  return (
    <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-indigo-950">
            <MapPin className="h-5 w-5" />
            {isAr ? 'تتبع التوصيل المباشر' : 'Live delivery tracking'}
          </h3>
          <p className="mt-1 text-sm text-indigo-900/80">
            {isAr
              ? 'موقع المندوب يُحدَّث كل ~20 ثانية عند تفعيل المشاركة.'
              : 'Driver location updates about every 20 seconds when sharing is on.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>
          {onClose && (
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              {isAr ? 'إخفاء' : 'Hide'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && !snapshot ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : (
        <>
          {snapshot?.mapVisible === false && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {isAr
                ? 'الموقع المباشر غير متاح — لم يُحدَّث موقع المندوب منذ فترة.'
                : 'Live map hidden — driver location has not updated recently.'}
            </p>
          )}

          {(etaLabel || snapshot?.route?.distanceText) && (
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              {etaLabel && (
                <p className="font-semibold text-indigo-950">
                  {isAr ? 'الوصول المتوقع:' : 'ETA:'}{' '}
                  <span className="font-bold">{etaLabel}</span>
                </p>
              )}
              {snapshot?.route?.distanceText && (
                <p className="text-indigo-900/80">
                  {isAr ? 'المسافة:' : 'Distance:'} {snapshot.route.distanceText}
                </p>
              )}
              {snapshot?.driver?.updatedAt && (
                <p className="text-indigo-900/70">
                  {isAr ? 'آخر تحديث:' : 'Updated:'}{' '}
                  {new Date(snapshot.driver.updatedAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {formatLocationAge(snapshot.driver.updatedAt, isAr)}
                </p>
              )}
            </div>
          )}

          <TrackingMapView
            destination={snapshot?.destination}
            driver={snapshot?.driver}
            routePath={snapshot?.route?.path || []}
            isAr={isAr}
            mapVisible={snapshot?.mapVisible !== false}
            fallbackReason="stale"
          />

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-indigo-900/80">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />
              {isAr ? 'عنوان التوصيل' : 'Delivery address'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-indigo-600" />
              {isAr ? 'مندوب التوصيل' : 'Driver'}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
