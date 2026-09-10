import { Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';

/**
 * Thin pale-blue ETA strip below the header (HyperOne pattern).
 * Shows the nearest delivery slot for the selected zone + the free-delivery threshold.
 * Renders nothing when there is no usable delivery estimate.
 */
export default function DeliverySlotStrip({ className = '' }) {
  const { language, t } = useLanguage();
  const { location } = useLocation();
  const { settings } = useStoreSettings();
  const isAr = language === 'ar';

  const eta = location?.estimatedExpress || location?.estimatedScheduled || '';
  const announcement = isAr
    ? settings?.navigation?.announcementAr
    : settings?.navigation?.announcementEn;
  const threshold = settings?.freeDeliveryThreshold ?? location?.freeDeliveryThreshold ?? null;

  if (!eta && !announcement && !threshold) return null;

  return (
    <div className={`border-y border-primary-100 bg-primary-50 ${className}`}>
      <div className="container-app flex items-center justify-center gap-x-6 gap-y-1 py-1.5 text-center text-[12px] font-medium text-primary-800 sm:justify-between">
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
          {eta
            ? `${t.nav.deliverySlot}: ${eta}`
            : (announcement || (isAr ? 'التوصيل متاح لمنطقتك' : 'Delivery available in your area'))}
        </span>
        {threshold ? (
          <span className="hidden sm:inline text-primary-700">
            {t.nav.freeDeliveryOver} {threshold} {isAr ? 'ج.م' : 'EGP'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
