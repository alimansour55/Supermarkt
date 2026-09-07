import FulfillmentLocation from '../models/FulfillmentLocation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { geocodeAddress, reverseGeocode, geocodePlaceId } from '../services/googleMaps.service.js';
import {
  clearOtherDefaultLocations,
  formatFulfillmentLocation,
} from '../services/fulfillmentLocation.service.js';

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

  if (lat != null && lng != null) {
    const result = await reverseGeocode(Number(lat), Number(lng));
    if (!result) throw new AppError('Could not resolve coordinates to an address', 404);
    return res.json({ success: true, data: result });
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
