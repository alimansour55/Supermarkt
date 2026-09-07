import FulfillmentLocation from '../models/FulfillmentLocation.js';

export function formatFulfillmentLocation(doc) {
  const raw = doc?.toObject?.() ?? doc;
  if (!raw) return null;

  const zoneIds = (raw.deliveryZones || []).map((z) =>
    (z?._id || z)?.toString?.() || String(z),
  );

  return {
    id: raw._id?.toString(),
    _id: raw._id,
    name: raw.name,
    address: raw.address,
    lat: raw.lat,
    lng: raw.lng,
    formattedAddress: raw.formattedAddress || '',
    placeId: raw.placeId || '',
    isDefault: raw.isDefault === true,
    deliveryZones: zoneIds,
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function clearOtherDefaultLocations(exceptId = null) {
  const filter = { isDefault: true };
  if (exceptId) {
    filter._id = { $ne: exceptId };
  }
  await FulfillmentLocation.updateMany(filter, { $set: { isDefault: false } });
}

/**
 * Pick ship-from location: zone-linked first, then default, then any active.
 */
export async function resolveFulfillmentLocationForZone(deliveryZoneId) {
  const zoneId = deliveryZoneId?.toString?.() || deliveryZoneId;

  if (zoneId && /^[a-f\d]{24}$/i.test(zoneId)) {
    const byZone = await FulfillmentLocation.findOne({
      isActive: true,
      deliveryZones: zoneId,
    }).sort({ isDefault: -1, createdAt: 1 });
    if (byZone) return byZone;
  }

  const defaultLocation = await FulfillmentLocation.findOne({
    isDefault: true,
    isActive: true,
  });
  if (defaultLocation) return defaultLocation;

  return FulfillmentLocation.findOne({ isActive: true }).sort({ createdAt: 1 });
}

export async function loadFulfillmentLocationById(id) {
  if (!id) return null;
  const location = await FulfillmentLocation.findById(id).lean();
  return location ? formatFulfillmentLocation(location) : null;
}
