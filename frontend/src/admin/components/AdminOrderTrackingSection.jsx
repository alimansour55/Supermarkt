import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../app/router';
import { AlertTriangle, MapPin, Phone, RefreshCw, Truck } from 'lucide-react';
import { adminApi } from '../adminApi';
import TrackingMapView from '../../components/order/TrackingMapView';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import {
  formatEta,
  formatLocationAge,
  isDriverLocationStale,
} from '../../utils/orderTracking';

const POLL_MS = 30_000;
const DEV = import.meta.env.DEV;

export default function AdminOrderTrackingSection({ orderId, orderNumber, isAr, compact = false }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simRunning, setSimRunning] = useState(false);
  const [simBusy, setSimBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!orderId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.getOrderTracking(orderId);
      setSnapshot(data.data);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر تحميل التتبع' : 'Could not load tracking'));
      setSnapshot(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, isAr]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!DEV || !orderId) return;
    adminApi.getTrackingSimulation(orderId)
      .then(({ data }) => setSimRunning(Boolean(data.data?.running)))
      .catch(() => {});
  }, [orderId]);

  const toggleSim = useCallback(async () => {
    setSimBusy(true);
    try {
      if (simRunning) {
        await adminApi.stopTrackingSimulation(orderId);
        setSimRunning(false);
      } else {
        await adminApi.startTrackingSimulation(orderId, { speedKmh: 30 });
        setSimRunning(true);
        setTimeout(() => load(true), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed');
    } finally {
      setSimBusy(false);
    }
  }, [orderId, simRunning, load]);

  const stale = snapshot?.locationStale
    || isDriverLocationStale(snapshot?.driver?.updatedAt || snapshot?.driverUpdatedAt);
  const updatedAt = snapshot?.driver?.updatedAt || snapshot?.driverUpdatedAt;
  const driverInfo = snapshot?.driverInfo;

  const etaLabel = snapshot?.route?.etaText
    || (snapshot?.estimatedDeliveryAt ? formatEta(snapshot.estimatedDeliveryAt, isAr) : '');

  return (
    <section className={`rounded-2xl border border-indigo-200 bg-indigo-50/50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-indigo-950">
            <MapPin className="h-4 w-4" />
            {isAr ? 'تتبع مباشر' : 'Live tracking'}
          </h3>
          {!compact && (
            <p className="mt-0.5 text-xs text-indigo-900/75">
              {isAr
                ? 'موقع المندوب + عنوان العميل (ليس موقع العميل المباشر).'
                : 'Driver GPS + customer address pin (not customer live GPS).'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {DEV && (
            <Button
              type="button"
              size="sm"
              variant={simRunning ? 'danger' : 'primary'}
              onClick={toggleSim}
              disabled={simBusy}
            >
              <Truck className="h-4 w-4" />
              {simRunning ? 'Stop sim' : 'Simulate driver (dev)'}
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && !snapshot ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : snapshot && (
        <>
          {stale && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {isAr ? 'موقع المندوب قديم' : 'Driver location may be stale'}
                </p>
                <p className="text-xs text-amber-900/90">
                  {isAr
                    ? 'لم يُحدَّث منذ أكثر من دقيقتين — تحقق من GPS أو اتصال المندوب.'
                    : 'No update for over 2 minutes — possible GPS or connection issue.'}
                </p>
              </div>
            </div>
          )}

          {driverInfo && (
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-indigo-950">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Truck className="h-4 w-4" aria-hidden />
                {driverInfo.name}
              </span>
              {driverInfo.phone && (
                <a
                  href={`tel:${driverInfo.phone}`}
                  className="inline-flex items-center gap-1 text-primary-700"
                  dir="ltr"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {driverInfo.phone}
                </a>
              )}
              {updatedAt && (
                <span className="text-xs text-indigo-900/70">
                  {isAr ? 'آخر تحديث:' : 'Updated:'}{' '}
                  {new Date(updatedAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  ({formatLocationAge(updatedAt, isAr)})
                </span>
              )}
            </div>
          )}

          {(etaLabel || snapshot?.route?.distanceText) && (
            <div className="mb-3 flex flex-wrap gap-4 text-sm text-indigo-950">
              {etaLabel && (
                <p>
                  <span className="font-medium">{isAr ? 'الوصول:' : 'ETA:'}</span> {etaLabel}
                </p>
              )}
              {snapshot?.route?.distanceText && (
                <p className="text-indigo-900/80">
                  {isAr ? 'المسافة:' : 'Distance:'} {snapshot.route.distanceText}
                </p>
              )}
            </div>
          )}

          <TrackingMapView
            destination={snapshot.destination}
            driver={snapshot.driver}
            routePath={snapshot.route?.path || []}
            isAr={isAr}
            className={compact ? 'h-64' : 'h-80'}
            mapVisible
            showDriverPin={!stale || Boolean(snapshot.driver)}
          />

          {orderNumber && (
            <p className="mt-2 text-center text-xs text-indigo-900/70">
              <Link to={`/admin/orders?order=${orderId}`} className="font-medium text-primary-600 hover:underline">
                {isAr ? `فتح الطلب #${orderNumber}` : `Open order #${orderNumber}`}
              </Link>
              {' · '}
              <Link to="/admin/live-deliveries" className="font-medium text-primary-600 hover:underline">
                {isAr ? 'لوحة التوصيل المباشر' : 'Live deliveries board'}
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
