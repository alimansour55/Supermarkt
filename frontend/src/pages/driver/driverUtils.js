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
