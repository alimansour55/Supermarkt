import DeliveryZone from '../models/DeliveryZone.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  findDeliveryZone,
  formatDeliveryZone,
  listPublicDeliveryZones,
} from '../services/deliveryZone.service.js';
import { getAddressSuggestions } from '../services/placeSuggestion.service.js';
import { geocodeAddress, reverseGeocode, geocodePlaceId, isGoogleMapsConfigured } from '../services/googleMaps.service.js';
import { reverseGeocodeOsm } from '../services/osmGeocode.service.js';
import { addressMatchesDeliveryZone } from '../utils/addressZoneValidation.js';

const normalizeFreeDeliveryMethodsInput = (body) => {
  if (!Array.isArray(body.freeDeliveryMethods)) {
    return ['scheduled', 'recurring'];
  }
  const methods = body.freeDeliveryMethods.filter((m) => ['scheduled', 'express', 'recurring'].includes(m));
  if (!methods.length) {
    throw new AppError('Select at least one delivery method for free delivery', 400);
  }
  return methods;
};

const normalizePayload = (body) => ({
  cityAr: body.cityAr,
  cityEn: body.cityEn,
  areaAr: body.areaAr,
  areaEn: body.areaEn,
  scheduledFee: Number(body.scheduledFee) || 0,
  expressFee: Number(body.expressFee) || 0,
  minimumOrder: Number(body.minimumOrder) || 0,
  freeDeliveryThreshold: Number(body.freeDeliveryThreshold) || 0,
  freeDeliveryOverride: body.freeDeliveryOverride === true,
  freeDeliveryMethods: normalizeFreeDeliveryMethodsInput(body),
  scheduledAvailable: body.scheduledAvailable !== false,
  expressAvailable: body.expressAvailable !== false,
  estimatedScheduled: body.estimatedScheduled || '',
  estimatedExpress: body.estimatedExpress || '',
  timeSlots: Array.isArray(body.timeSlots) ? body.timeSlots : [],
  leadTimeOverride: body.leadTimeOverride === true,
  scheduledMinLeadMinutes: Math.min(1440, Math.max(0, Math.round(Number(body.scheduledMinLeadMinutes) || 120))),
  expressMinLeadMinutes: Math.min(1440, Math.max(0, Math.round(Number(body.expressMinLeadMinutes) || 120))),
  priority: Number(body.priority) || 0,
  centerLat: body.centerLat === '' || body.centerLat == null ? null : Number(body.centerLat),
  centerLng: body.centerLng === '' || body.centerLng == null ? null : Number(body.centerLng),
  radiusKm: Math.max(0, Number(body.radiusKm) || 8),
  isActive: body.isActive !== false,
});

export const getPublicDeliveryZones = asyncHandler(async (_req, res) => {
  const zones = await listPublicDeliveryZones();
  res.json({ success: true, data: zones });
});

export const validateDeliveryZone = asyncHandler(async (req, res) => {
  const zone = await findDeliveryZone(req.query.zoneId || req.body.zoneId);
  if (!zone) throw new AppError('Selected delivery area is not serviceable', 404);
  res.json({ success: true, data: zone });
});

export const getAdminDeliveryZones = asyncHandler(async (_req, res) => {
  const zones = await DeliveryZone.find().sort({ priority: -1, cityEn: 1, areaEn: 1 });
  res.json({ success: true, data: zones.map(formatDeliveryZone) });
});

export const createAdminDeliveryZone = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);
  const zone = await DeliveryZone.create({
    ...payload,
    createdBy: req.user?._id || null,
  });
  res.status(201).json({ success: true, data: formatDeliveryZone(zone) });
});

export const updateAdminDeliveryZone = asyncHandler(async (req, res) => {
  const zone = await DeliveryZone.findById(req.params.id);
  if (!zone) throw new AppError('Delivery zone not found', 404);
  const payload = normalizePayload(req.body);
  Object.assign(zone, payload);
  zone.timeSlots = payload.timeSlots;
  zone.set('freeDeliveryMethods', [...payload.freeDeliveryMethods]);
  zone.freeDeliveryOverride = payload.freeDeliveryOverride;
  zone.leadTimeOverride = payload.leadTimeOverride;
  zone.scheduledMinLeadMinutes = payload.scheduledMinLeadMinutes;
  zone.expressMinLeadMinutes = payload.expressMinLeadMinutes;
  zone.markModified('timeSlots');
  zone.markModified('freeDeliveryMethods');
  zone.markModified('freeDeliveryOverride');
  zone.markModified('leadTimeOverride');
  await zone.save();
  res.json({ success: true, data: formatDeliveryZone(zone) });
});

export const deleteAdminDeliveryZone = asyncHandler(async (req, res) => {
  const zone = await DeliveryZone.findByIdAndDelete(req.params.id);
  if (!zone) throw new AppError('Delivery zone not found', 404);
  res.json({ success: true });
});

export const geocodeDeliveryAddress = asyncHandler(async (req, res) => {
  const { address, lat, lng, placeId } = req.body;

  if (lat != null && lng != null) {
    const language = String(req.body?.language || 'ar').startsWith('en') ? 'en' : 'ar';
    const pinLat = Number(lat);
    const pinLng = Number(lng);

    const [googleResult, osmResult] = await Promise.all([
      reverseGeocode(pinLat, pinLng),
      reverseGeocodeOsm(pinLat, pinLng, { language }),
    ]);

    let result = googleResult || osmResult;
    if (googleResult && osmResult) {
      result = {
        ...googleResult,
        lat: pinLat,
        lng: pinLng,
        street: googleResult.street || osmResult.street || '',
        building: googleResult.building || osmResult.building || '',
        area: googleResult.area || osmResult.area || '',
        city: googleResult.city || osmResult.city || '',
        governorate: googleResult.governorate || osmResult.governorate || '',
        formattedAddress: googleResult.formattedAddress || osmResult.formattedAddress || '',
        placeId: googleResult.placeId || osmResult.placeId || '',
      };
    }

    if (!result) throw new AppError('Could not resolve coordinates to an address', 404);
    return res.json({ success: true, data: { ...result, lat: pinLat, lng: pinLng } });
  }

  if (placeId) {
    const result = await geocodePlaceId(placeId);
    if (!result) throw new AppError('Place not found', 404);
    return res.json({ success: true, data: result });
  }

  const query = String(address || '').trim();
  if (!query) throw new AppError('Address or coordinates are required', 400);

  const result = await geocodeAddress(query);
  if (!result) throw new AppError('Address not found', 404);

  res.json({ success: true, data: result });
});

export const suggestDeliveryPlaces = asyncHandler(async (req, res) => {
  const query = String(req.body?.query || req.body?.input || '').trim();
  if (!query) {
    return res.json({ success: true, data: [], source: 'none' });
  }

  const language = String(req.body?.language || 'ar').startsWith('en') ? 'en' : 'ar';
  const biasLat = req.body?.biasLat != null ? Number(req.body.biasLat) : undefined;
  const biasLng = req.body?.biasLng != null ? Number(req.body.biasLng) : undefined;
  const { data, source, googleError } = await getAddressSuggestions(query, { language, biasLat, biasLng });

  res.json({
    success: true,
    data,
    source,
    googleError,
    mapsConfigured: isGoogleMapsConfigured(),
  });
});

export const resolveDeliveryPlace = asyncHandler(async (req, res) => {
  const placeId = String(req.body?.placeId || '').trim();
  if (!placeId) throw new AppError('placeId is required', 400);

  const result = await geocodePlaceId(placeId);
  if (!result) throw new AppError('Place not found', 404);

  res.json({ success: true, data: result });
});

export const validateDeliveryAddress = asyncHandler(async (req, res) => {
  const { deliveryZoneId, formattedAddress, addressComponents, street, area, city, lat, lng } = req.body;
  const zone = await findDeliveryZone(deliveryZoneId);
  if (!zone) throw new AppError('Selected delivery area is not serviceable', 404);

  let components = addressComponents;
  let formatted = formattedAddress;

  if ((!formatted || !components?.length) && lat != null && lng != null) {
    const reversed = await reverseGeocode(Number(lat), Number(lng));
    if (reversed) {
      formatted = reversed.formattedAddress;
      components = reversed.addressComponents;
    }
  }

  const matches = addressMatchesDeliveryZone(
    { formattedAddress: formatted, addressComponents: components, street, area, city },
    zone,
  );

  if (!matches) {
    throw new AppError('Address is outside the selected delivery area', 400);
  }

  res.json({ success: true, data: { valid: true, zone: formatDeliveryZone(zone) } });
});
