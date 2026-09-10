import FulfillmentLocation from '../models/FulfillmentLocation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { geocodeAddress, reverseGeocode, geocodePlaceId } from '../services/googleMaps.service.js';
import { getOsmSuggestions, reverseGeocodeOsm } from '../services/osmGeocode.service.js';
import {
  clearOtherDefaultLocations,
  formatFulfillmentLocation,
} from '../services/fulfillmentLocation.service.js';

const pickLanguage = (value) => (String(value || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar');

const mergeGeocode = (primary, secondary, lat, lng) => {
  if (!primary) return secondary ? { ...secondary, lat, lng } : null;
  if (!secondary) return { ...primary, lat, lng };
  return {
    ...primary,
    lat,
    lng,
    street: primary.street || secondary.street || '',
    building: primary.building || secondary.building || '',
    area: primary.area || secondary.area || '',
    city: primary.city || secondary.city || '',
    governorate: primary.governorate || secondary.governorate || '',
    formattedAddress: primary.formattedAddress || secondary.formattedAddress || '',
    placeId: primary.placeId || secondary.placeId || '',
  };
};

const normalizeZoneIds = (body) => {
  const raw = body.deliveryZones ?? body.deliveryZoneIds ?? [];
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id).trim()).filter((id) => /^[a-f\d]{24}$/i.test(id)))];
};

const normalizePayload = (body) => {
  const name = String(body.name || '').trim();
  const address = String(body.address || '').trim();
  if (!name) throw new AppError('Location name is required', 400);
  if (!address) throw new AppError('Address is required', 400);

  const lat = body.lat != null && body.lat !== '' ? Number(body.lat) : null;
  const lng = body.lng != null && body.lng !== '' ? Number(body.lng) : null;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new AppError('Map location (latitude and longitude) is required', 400);
  }

  return {
    name,
    address,
    lat,
    lng,
    formattedAddress: String(body.formattedAddress || address).trim(),
    placeId: String(body.placeId || '').trim(),
    isDefault: body.isDefault === true,
    deliveryZones: normalizeZoneIds(body),
    isActive: body.isActive !== false,
  };
};

export const getAdminFulfillmentLocations = asyncHandler(async (_req, res) => {
  const locations = await FulfillmentLocation.find()
    .sort({ isDefault: -1, name: 1 });
  res.json({ success: true, data: locations.map(formatFulfillmentLocation) });
});

export const createAdminFulfillmentLocation = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);
  if (payload.isDefault) {
    await clearOtherDefaultLocations();
  }
  const location = await FulfillmentLocation.create({
    ...payload,
    createdBy: req.user?._id || null,
  });
  res.status(201).json({ success: true, data: formatFulfillmentLocation(location) });
});

export const updateAdminFulfillmentLocation = asyncHandler(async (req, res) => {
  const location = await FulfillmentLocation.findById(req.params.id);
  if (!location) throw new AppError('Fulfillment location not found', 404);

  const payload = normalizePayload(req.body);
  if (payload.isDefault) {
    await clearOtherDefaultLocations(location._id);
  }

  Object.assign(location, payload);
  location.markModified('deliveryZones');
  await location.save();

  res.json({ success: true, data: formatFulfillmentLocation(location) });
});

export const deleteAdminFulfillmentLocation = asyncHandler(async (req, res) => {
  const location = await FulfillmentLocation.findByIdAndDelete(req.params.id);
  if (!location) throw new AppError('Fulfillment location not found', 404);
  res.json({ success: true });
});

export const geocodeAdminFulfillmentLocation = asyncHandler(async (req, res) => {
  const { address, lat, lng, placeId } = req.body;
  const language = pickLanguage(req.body?.language);

  if (lat != null && lng != null && lat !== '' && lng !== '') {
    const pinLat = Number(lat);
    const pinLng = Number(lng);
    if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng)) {
      throw new AppError('Invalid coordinates', 400);
    }

    // Google first (when configured), then OpenStreetMap so the picker still
    // resolves an address with no Google Maps billing set up.
    const [googleResult, osmResult] = await Promise.all([
      reverseGeocode(pinLat, pinLng).catch(() => null),
      reverseGeocodeOsm(pinLat, pinLng, { language }).catch(() => null),
    ]);

    const result = mergeGeocode(googleResult, osmResult, pinLat, pinLng);
    if (!result) {
      // Coordinates are valid even when no address service answered — let the
      // admin keep the pin and type the address manually.
      return res.json({ success: true, data: { lat: pinLat, lng: pinLng, formattedAddress: '', placeId: '' } });
    }
    return res.json({ success: true, data: { ...result, lat: pinLat, lng: pinLng } });
  }

  if (placeId) {
    const result = await geocodePlaceId(placeId).catch(() => null);
    if (result) return res.json({ success: true, data: result });
    // fall through to text search on the place label if we have one
  }

  const query = String(address || '').trim();
  if (!query) throw new AppError('Address or coordinates are required', 400);

  const googleGeo = await geocodeAddress(query).catch(() => null);
  if (googleGeo) return res.json({ success: true, data: googleGeo });

  const [osmMatch] = await getOsmSuggestions(query, { language }).catch(() => []);
  if (osmMatch && Number.isFinite(osmMatch.lat) && Number.isFinite(osmMatch.lng)) {
    return res.json({
      success: true,
      data: {
        lat: osmMatch.lat,
        lng: osmMatch.lng,
        formattedAddress: osmMatch.formattedAddress || osmMatch.description || query,
        placeId: osmMatch.placeId || '',
      },
    });
  }

  throw new AppError('Address not found', 404);
});
