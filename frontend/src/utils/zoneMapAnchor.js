import { deliveryZoneService } from '../services/apiServices';
import { haversineKm, ZONE_GPS_MAX_KM } from './geoDistance';

/** Approximate map centres for common Egypt delivery areas (offline fallback). */
const STATIC_ANCHORS = [
  { keys: ['15 مايو', '15 may', '15th of may', '15th may'], lat: 29.8162, lng: 31.3714 },
  { keys: ['حلوان', 'helwan'], lat: 29.8482, lng: 31.3342 },
  { keys: ['مدينة نصر', 'nasr city', 'nasr-city'], lat: 30.0511, lng: 31.3656 },
  { keys: ['المعادي', 'maadi'], lat: 29.9602, lng: 31.2569 },
  { keys: ['مصر الجديدة', 'heliopolis'], lat: 30.0875, lng: 31.3244 },
  { keys: ['الدقي', 'dokki'], lat: 30.0381, lng: 31.2089 },
  { keys: ['6 أكتوبر', '6th of october', '6 october'], lat: 29.9285, lng: 30.9188 },
  { keys: ['سموحة', 'smouha'], lat: 31.2156, lng: 29.9425 },
  { keys: ['التجمع', 'tagamo', 'new cairo'], lat: 30.0131, lng: 31.4913 },
  { keys: ['شبرا', 'shubra'], lat: 30.0745, lng: 31.2456 },
  { keys: ['المهندسين', 'mohandeseen'], lat: 30.0561, lng: 31.2001 },
];

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function zoneHaystack(zone) {
  return normalizeText([
    zone?.slug,
    zone?.areaAr,
    zone?.areaEn,
    zone?.cityAr,
    zone?.cityEn,
    zone?.nameAr,
    zone?.nameEn,
  ].filter(Boolean).join(' '));
}

function lookupStaticAnchor(zone) {
  const haystack = zoneHaystack(zone);
  if (!haystack) return null;

  for (const entry of STATIC_ANCHORS) {
    if (entry.keys.some((key) => haystack.includes(normalizeText(key)))) {
      return { lat: entry.lat, lng: entry.lng, source: 'static' };
    }
  }
  return null;
}

export function addressTextMatchesZone(address = {}, zone) {
  if (!zone) return true;

  const haystack = normalizeText([
    address.formattedAddress,
    address.street,
    address.area,
    address.city,
    address.governorate,
  ].filter(Boolean).join(' '));

  if (!haystack) return false;

  const needles = [
    zone.areaAr,
    zone.areaEn,
    zone.cityAr,
    zone.cityEn,
    zone.nameAr,
    zone.nameEn,
    zone.slug?.replace(/-/g, ' '),
  ]
    .filter(Boolean)
    .map(normalizeText)
    .filter((needle, index, list) => needle.length >= 2 && list.indexOf(needle) === index);

  return needles.some((needle) => haystack.includes(needle));
}

export function pinMatchesDeliveryZone(pin, zone, anchor, address = {}) {
  if (!pin?.lat || pin?.lng == null || !anchor) return true;
  const dist = haversineKm(pin.lat, pin.lng, anchor.lat, anchor.lng);
  if (dist <= ZONE_GPS_MAX_KM) return true;
  return addressTextMatchesZone(address, zone);
}

/**
 * Resolve a map centre for the selected delivery zone (static hint → backend geocode).
 */
export async function resolveZoneMapAnchor(deliveryZone, isAr = true) {
  if (!deliveryZone) return null;

  const staticAnchor = lookupStaticAnchor(deliveryZone);
  if (staticAnchor) return staticAnchor;

  const query = isAr
    ? `${deliveryZone.areaAr || deliveryZone.nameAr}، ${deliveryZone.cityAr || ''}، مصر`.replace(/،\s*،/g, '،')
    : `${deliveryZone.areaEn || deliveryZone.nameEn}, ${deliveryZone.cityEn || ''}, Egypt`.replace(/,\s*,/g, ',');

  try {
    const { data } = await deliveryZoneService.geocode({ address: query.trim() });
    const row = data?.data;
    if (row?.lat != null && row?.lng != null) {
      return { lat: Number(row.lat), lng: Number(row.lng), source: 'geocode' };
    }
  } catch {
    // fall through
  }

  return null;
}

export function zoneAnchorLabel(zone, isAr) {
  if (!zone) return '';
  return isAr ? (zone.nameAr || `${zone.areaAr}، ${zone.cityAr}`) : (zone.nameEn || `${zone.areaEn}, ${zone.cityEn}`);
}
