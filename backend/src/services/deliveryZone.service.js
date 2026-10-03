import mongoose from 'mongoose';
import DeliveryZone from '../models/DeliveryZone.js';
import StoreSettings from '../models/StoreSettings.js';
import { AppError } from '../utils/AppError.js';
import { filterFreeDeliveryMethods } from '../utils/freeDelivery.js';
import { haversineKm } from '../utils/zoneCoverage.js';

export const DEFAULT_DELIVERY_ZONES = [
  {
    id: 'cairo-helwan',
    _id: 'cairo-helwan',
    slug: 'cairo-helwan',
    cityAr: 'القاهرة',
    cityEn: 'Cairo',
    areaAr: 'حلوان',
    areaEn: 'Helwan',
    nameAr: 'حلوان، القاهرة',
    nameEn: 'Helwan, Cairo',
    centerLat: 29.8453,
    centerLng: 31.3339,
    radiusKm: 10,
    scheduledFee: 24.99,
    expressFee: 44.99,
    minimumOrder: 0,
    freeDeliveryThreshold: 500,
    freeDeliveryOverride: false,
    freeDeliveryMethods: ['scheduled', 'recurring'],
    scheduledAvailable: true,
    expressAvailable: true,
    estimatedScheduled: '4-6 hours',
    estimatedExpress: 'within 2 hours',
    timeSlots: [
      { _id: 'morning', labelAr: 'صباحا (9-12)', labelEn: 'Morning (9-12)', from: '09:00', to: '12:00', isActive: true },
      { _id: 'afternoon', labelAr: 'مساء (2-6)', labelEn: 'Afternoon (2-6)', from: '14:00', to: '18:00', isActive: true },
      { _id: 'evening', labelAr: 'ليلا (6-9)', labelEn: 'Evening (6-9)', from: '18:00', to: '21:00', isActive: true },
    ],
    priority: 100,
    isActive: true,
  },
  {
    id: 'cairo-maadi',
    _id: 'cairo-maadi',
    slug: 'cairo-maadi',
    cityAr: 'القاهرة',
    cityEn: 'Cairo',
    areaAr: 'المعادي',
    areaEn: 'Maadi',
    nameAr: 'المعادي، القاهرة',
    nameEn: 'Maadi, Cairo',
    centerLat: 29.9603,
    centerLng: 31.2569,
    radiusKm: 8,
    scheduledFee: 29.99,
    expressFee: 49.99,
    minimumOrder: 0,
    freeDeliveryThreshold: 500,
    freeDeliveryOverride: false,
    freeDeliveryMethods: ['scheduled', 'recurring'],
    scheduledAvailable: true,
    expressAvailable: true,
    estimatedScheduled: '4-6 hours',
    estimatedExpress: 'within 2 hours',
    timeSlots: [
      { _id: 'morning', labelAr: 'صباحا (9-12)', labelEn: 'Morning (9-12)', from: '09:00', to: '12:00', isActive: true },
      { _id: 'afternoon', labelAr: 'مساء (2-6)', labelEn: 'Afternoon (2-6)', from: '14:00', to: '18:00', isActive: true },
      { _id: 'evening', labelAr: 'ليلا (6-9)', labelEn: 'Evening (6-9)', from: '18:00', to: '21:00', isActive: true },
    ],
    isActive: true,
  },
  {
    id: 'cairo-nasr-city',
    _id: 'cairo-nasr-city',
    slug: 'cairo-nasr-city',
    cityAr: 'القاهرة',
    cityEn: 'Cairo',
    areaAr: 'مدينة نصر',
    areaEn: 'Nasr City',
    nameAr: 'مدينة نصر، القاهرة',
    nameEn: 'Nasr City, Cairo',
    centerLat: 30.0566,
    centerLng: 31.3300,
    radiusKm: 8,
    scheduledFee: 29.99,
    expressFee: 49.99,
    minimumOrder: 0,
    freeDeliveryThreshold: 500,
    freeDeliveryOverride: false,
    freeDeliveryMethods: ['scheduled', 'recurring'],
    scheduledAvailable: true,
    expressAvailable: true,
    estimatedScheduled: '4-6 hours',
    estimatedExpress: 'within 2 hours',
    timeSlots: [
      { _id: 'morning', labelAr: 'صباحا (9-12)', labelEn: 'Morning (9-12)', from: '09:00', to: '12:00', isActive: true },
      { _id: 'afternoon', labelAr: 'مساء (2-6)', labelEn: 'Afternoon (2-6)', from: '14:00', to: '18:00', isActive: true },
    ],
    isActive: true,
  },
  {
    id: 'giza-dokki',
    _id: 'giza-dokki',
    slug: 'giza-dokki',
    cityAr: 'الجيزة',
    cityEn: 'Giza',
    areaAr: 'الدقي',
    areaEn: 'Dokki',
    nameAr: 'الدقي، الجيزة',
    nameEn: 'Dokki, Giza',
    centerLat: 30.0384,
    centerLng: 31.2119,
    radiusKm: 7,
    scheduledFee: 34.99,
    expressFee: 59.99,
    minimumOrder: 100,
    freeDeliveryThreshold: 600,
    freeDeliveryMethods: ['scheduled', 'recurring'],
    scheduledAvailable: true,
    expressAvailable: false,
    estimatedScheduled: '4-6 hours',
    estimatedExpress: '',
    timeSlots: [
      { _id: 'afternoon', labelAr: 'مساء (2-6)', labelEn: 'Afternoon (2-6)', from: '14:00', to: '18:00', isActive: true },
      { _id: 'evening', labelAr: 'ليلا (6-9)', labelEn: 'Evening (6-9)', from: '18:00', to: '21:00', isActive: true },
    ],
    isActive: true,
  },
];

export const formatDeliveryZone = (zone) => {
  const raw = zone.toObject?.() || zone;
  const id = raw._id?.toString?.() || raw.id || raw.slug;
  return {
    ...raw,
    _id: id,
    id,
    nameAr: raw.nameAr || `${raw.areaAr}، ${raw.cityAr}`,
    nameEn: raw.nameEn || `${raw.areaEn}, ${raw.cityEn}`,
    centerLat: raw.centerLat ?? null,
    centerLng: raw.centerLng ?? null,
    radiusKm: raw.radiusKm ?? 8,
    freeDeliveryMethods: filterFreeDeliveryMethods(raw.freeDeliveryMethods),
    freeDeliveryOverride: raw.freeDeliveryOverride === true,
    timeSlots: (raw.timeSlots || []).filter((slot) => slot.isActive !== false),
  };
};

/**
 * Geographic coverage (centerLat/Lng + radiusKm) is the source of truth for what is
 * serviceable — a zone name alone must never let a customer order from outside it.
 */
const hasCoverage = (zone) => zone.centerLat != null && zone.centerLng != null;

/**
 * The coverage areas (the umbrella) the admin has configured — one or more independent
 * circles, not necessarily adjacent (e.g. separate circles for Cairo and Alexandria).
 * Delivery zones are sub-areas inside them — a zone can never grant coverage beyond them.
 */
async function getCoverageAreas() {
  const settings = await StoreSettings.findOne({ key: 'main' }).lean();
  const areas = settings?.locationGate?.coverageAreas;
  if (!Array.isArray(areas) || !areas.length) return [];
  return areas.filter((a) => Number.isFinite(a?.lat) && Number.isFinite(a?.lng)
    && Number.isFinite(a?.radiusKm) && a.radiusKm > 0);
}

const withinCoverageAreas = (zone, coverageAreas) => {
  if (!coverageAreas.length) return true;
  if (!hasCoverage(zone)) return false;
  return coverageAreas.some(
    (area) => haversineKm({ lat: zone.centerLat, lng: zone.centerLng }, area) <= area.radiusKm,
  );
};

export async function listPublicDeliveryZones() {
  const zones = await DeliveryZone.find({ isActive: true }).sort({ priority: -1, cityEn: 1, areaEn: 1 });
  const formatted = (zones.length ? zones.map(formatDeliveryZone) : DEFAULT_DELIVERY_ZONES).filter(hasCoverage);
  const coverageAreas = await getCoverageAreas();
  return formatted.filter((zone) => withinCoverageAreas(zone, coverageAreas));
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[،,]/g, ' ')
    .replace(/\s+/g, ' ');
}

function zoneMatchesQuery(zone, query) {
  const haystack = normalizeSearchText([
    zone.nameAr,
    zone.nameEn,
    zone.areaAr,
    zone.areaEn,
    zone.cityAr,
    zone.cityEn,
  ].join(' '));
  const tokens = normalizeSearchText(query).split(' ').filter((token) => token.length >= 2);
  if (!tokens.length) return false;
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Match configured delivery areas by name (free, instant fallback).
 */
export async function searchDeliveryZoneSuggestions(input, { language = 'ar' } = {}) {
  const query = String(input || '').trim();
  if (query.length < 2) return [];

  let zones = DEFAULT_DELIVERY_ZONES;
  try {
    zones = await listPublicDeliveryZones();
  } catch {
    // Mongo unavailable — use built-in defaults.
  }

  const isEn = String(language).startsWith('en');

  return zones
    .filter((zone) => zoneMatchesQuery(zone, query))
    .slice(0, 5)
    .map((zone) => ({
      description: isEn ? zone.nameEn : zone.nameAr,
      placeId: `zone:${zone.id || zone.slug}`,
      mainText: isEn ? zone.areaEn : zone.areaAr,
      secondaryText: isEn ? zone.cityEn : zone.cityAr,
      source: 'local',
      deliveryZoneId: zone.id || zone.slug,
    }));
}

export async function findDeliveryZone(zoneId) {
  if (!zoneId) return null;
  const filters = [{ slug: zoneId }];
  if (mongoose.Types.ObjectId.isValid(zoneId)) filters.push({ _id: zoneId });
  const zone = await DeliveryZone.findOne({
    $or: filters,
    isActive: true,
  });

  if (zone) {
    const formatted = formatDeliveryZone(zone);
    if (!hasCoverage(formatted)) return null;
    const coverageAreas = await getCoverageAreas();
    return withinCoverageAreas(formatted, coverageAreas) ? formatted : null;
  }
  return DEFAULT_DELIVERY_ZONES.find((item) => item.id === zoneId || item.slug === zoneId) || null;
}

export function validateDeliveryForZone({ zone, deliveryMethod, subtotal, timeSlotId }) {
  if (!zone) throw new AppError('Selected delivery area is not serviceable', 400);
  if (Number(subtotal || 0) < Number(zone.minimumOrder || 0)) {
    throw new AppError(`Minimum order for ${zone.nameEn} is ${zone.minimumOrder} EGP`, 400);
  }
  if (deliveryMethod === 'express' && !zone.expressAvailable) {
    throw new AppError('Express delivery is not available in this area', 400);
  }
  if ((deliveryMethod === 'scheduled' || deliveryMethod === 'recurring') && !zone.scheduledAvailable) {
    throw new AppError('Standard delivery is not available in this area', 400);
  }
  if ((deliveryMethod === 'scheduled' || deliveryMethod === 'recurring') && timeSlotId) {
    const hasSlot = (zone.timeSlots || []).some(
      (slot) => String(slot._id) === String(timeSlotId) || slot._id === timeSlotId,
    );
    if (!hasSlot) throw new AppError('Selected delivery time slot is not available in this area', 400);
  }
}
