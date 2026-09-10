import { formatPrice } from '../../utils/formatters';

export function formatDriverAddress(addr, isAr) {
  if (!addr) return '—';
  const parts = [
    addr.street,
    addr.building,
    addr.floor,
    addr.area,
    addr.city,
    addr.governorate,
  ].filter(Boolean);
  return parts.join(isAr ? '، ' : ', ') || addr.formattedAddress || '—';
}

export function mapsDirectionsUrl(addr) {
  if (addr?.lat != null && addr?.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}&travelmode=driving`;
  }
  const q = encodeURIComponent(addr?.formattedAddress || formatDriverAddress(addr, false));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function wazeDirectionsUrl(addr) {
  if (addr?.lat != null && addr?.lng != null) {
    return `https://waze.com/ul?ll=${addr.lat},${addr.lng}&navigate=yes`;
  }
  const q = encodeURIComponent(addr?.formattedAddress || formatDriverAddress(addr, false));
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}

/** Normalise a local phone number to international digits (Egypt default). */
export function normalizePhoneIntl(phone, countryCode = '20') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith(countryCode)) return digits;
  if (digits.startsWith('0')) return `${countryCode}${digits.slice(1)}`;
  return digits;
}

export function whatsappUrl(phone) {
  const n = normalizePhoneIntl(phone);
  return n ? `https://wa.me/${n}` : '';
}

/** Straight-line distance in km between two {lat,lng} points. */
export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km, isAr) {
  if (km == null || Number.isNaN(km)) return '';
  if (km < 1) {
    const m = Math.round(km * 1000);
    return isAr ? `${m} م` : `${m} m`;
  }
  return isAr ? `${km.toFixed(1)} كم` : `${km.toFixed(1)} km`;
}

export function deliveryZoneName(order, isAr) {
  if (!order) return '';
  return (isAr
    ? order.deliveryZoneNameAr || order.deliveryZoneNameEn
    : order.deliveryZoneNameEn || order.deliveryZoneNameAr) || '';
}

export function itemName(item, isAr) {
  if (!item) return '';
  return (isAr ? item.nameAr : item.nameEn) || item.nameAr || item.nameEn || '';
}

export function paymentLabel(order, isAr) {
  if (!order) return '';
  if (order.paymentMethod === 'stripe') {
    return isAr ? 'مدفوع بالبطاقة' : 'Paid by card';
  }
  if (order.paymentMethod === 'instapay') {
    return order.paymentStatus === 'paid'
      ? (isAr ? 'Instapay — مؤكد' : 'Instapay — confirmed')
      : (isAr ? 'Instapay — بانتظار التأكيد' : 'Instapay — pending confirmation');
  }
  if (order.paymentMethod === 'vodafone_cash') {
    return order.paymentStatus === 'paid'
      ? (isAr ? 'فودافون كاش — مؤكد' : 'Vodafone Cash — confirmed')
      : (isAr ? 'فودافون كاش — بانتظار التأكيد' : 'Vodafone Cash — pending confirmation');
  }
  if (order.paymentStatus === 'paid') {
    return isAr ? 'تم التحصيل نقداً' : 'Cash collected';
  }
  return isAr ? 'الدفع عند الاستلام' : 'Cash on delivery';
}

export function formatDeliverySlot(slot, isAr) {
  if (!slot) return null;
  if (typeof slot === 'string') return slot;
  const label = isAr
    ? (slot.labelAr || slot.labelEn)
    : (slot.labelEn || slot.labelAr);
  if (label) return label;
  if (slot.from && slot.to) return `${slot.from} – ${slot.to}`;
  return slot.from || null;
}

export function formatOrderTotal(order) {
  return formatPrice(order?.total || 0);
}
