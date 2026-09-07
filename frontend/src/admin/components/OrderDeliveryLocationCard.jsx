import { ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';

function formatAddress(addr, isAr) {
  if (!addr) return '—';
  const parts = [
    addr.street,
    addr.building && (isAr ? `مبنى ${addr.building}` : `Bldg ${addr.building}`),
    addr.floor && (isAr ? `طابق ${addr.floor}` : `Floor ${addr.floor}`),
    addr.area,
    addr.city,
    addr.governorate,
  ].filter(Boolean);
  return parts.join(isAr ? '، ' : ', ') || addr.formattedAddress || '—';
}

function mapsUrl(addr) {
  if (addr?.lat != null && addr?.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${addr.lat},${addr.lng}`;
  }
  const q = encodeURIComponent(addr?.formattedAddress || formatAddress(addr, false));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function directionsUrl(addr) {
  if (addr?.lat != null && addr?.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}&travelmode=driving`;
  }
  return mapsUrl(addr);
}

export default function OrderDeliveryLocationCard({ address, isAr, compact = false }) {
  if (!address) return null;

  const hasPin = address.lat != null && address.lng != null;
  const isGps = address.locationSource === 'gps';

  return (
    <div className={`rounded-xl bg-slate-50/80 ring-1 ring-border/50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm ring-1 ring-border/40">
          <MapPin className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text">
              {isAr ? 'موقع التوصيل' : 'Delivery location'}
            </p>
            {isGps && (
              <span className="rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                GPS
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{formatAddress(address, isAr)}</p>
          {hasPin && (
            <p className="mt-1 font-mono text-[10px] text-text-muted/80" dir="ltr">
              {Number(address.lat).toFixed(6)}, {Number(address.lng).toFixed(6)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 ps-12">
        <a
          href={mapsUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-text shadow-sm ring-1 ring-border/60 transition hover:bg-slate-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {isAr ? 'الخريطة' : 'Map'}
        </a>
        {hasPin && (
          <a
            href={directionsUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Navigation className="h-3.5 w-3.5" />
            {isAr ? 'اتجاهات المندوب' : 'Directions'}
          </a>
        )}
      </div>
    </div>
  );
}

export function CustomerContactRow({ name, phone, alternatePhone, isAr }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700 ring-1 ring-primary-100">
        {(name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{name || (isAr ? 'عميل' : 'Customer')}</p>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-muted transition hover:text-primary-700"
            dir="ltr"
          >
            <Phone className="h-3 w-3" />
            {phone}
            {alternatePhone && (
              <span className="text-text-muted/60">
                {' · '}
                {isAr ? `بديل ${alternatePhone}` : `alt ${alternatePhone}`}
              </span>
            )}
          </a>
        )}
      </div>
    </div>
  );
}
