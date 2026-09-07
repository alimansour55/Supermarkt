import { AppError } from '../utils/AppError.js';
import { pickGeoFields, formatAddressForGeocoding } from '../utils/addressGeo.js';
import { addressMatchesDeliveryZone } from '../utils/addressZoneValidation.js';
import { geocodeAddress, reverseGeocode } from './googleMaps.service.js';
import { findDeliveryZone } from './deliveryZone.service.js';
import { getGpsDeliveryEnabled } from './storeSettings.service.js';

function zoneMismatchMessage(zone, lang) {
  const name = lang === 'ar' ? zone.nameAr : zone.nameEn;
  return lang === 'ar'
    ? `العنوان لا يقع ضمن منطقة التوصيل المختارة (${name}). حرّك الدبوس أو اختر منطقة أخرى.`
    : `Address is outside the selected delivery area (${name}). Move the pin or choose another area.`;
}

function missingPinMessage(lang) {
  return lang === 'ar'
    ? 'يرجى تحديد موقع التوصيل على الخريطة أو البحث عن عنوانك.'
    : 'Please pin your delivery location on the map or search for your address.';
}

/**
 * Geocode if needed, validate delivery zone, return normalized address + geo fields.
 */
export async function enrichAndValidateAddress(input, {
  deliveryZoneId,
  lang = 'en',
  requireMapPin,
} = {}) {
  const street = String(input.street || '').trim();
  if (!street) {
    throw new AppError(lang === 'ar' ? 'الشارع مطلوب' : 'Street is required', 400);
  }

  const mapPinRequired = requireMapPin ?? await getGpsDeliveryEnabled();

  if (!mapPinRequired) {
    const zone = deliveryZoneId ? await findDeliveryZone(deliveryZoneId) : null;
    return {
      label: input.label,
      street,
      building: input.building ? String(input.building).trim() : '',
      floor: input.floor ? String(input.floor).trim() : '',
      city: String(input.city || zone?.cityEn || '').trim(),
      governorate: input.governorate ? String(input.governorate).trim() : (zone?.cityEn || ''),
      area: String(input.area || zone?.areaEn || input.city || '').trim(),
      postalCode: input.postalCode ? String(input.postalCode).trim() : '',
      lat: null,
      lng: null,
      formattedAddress: formatAddressForGeocoding(input) || street,
      placeId: '',
      locationSource: input.locationSource || '',
      isDefault: input.isDefault,
    };
  }

  let geo = pickGeoFields(input);
  const hasPin = geo.lat != null && geo.lng != null;

  if (!hasPin) {
    const geocoded = await geocodeAddress({
      street,
      building: input.building,
      floor: input.floor,
      area: input.area,
      city: input.city,
      governorate: input.governorate,
      postalCode: input.postalCode,
    });
    if (!geocoded) {
      throw new AppError(missingPinMessage(lang), 400);
    }
    geo = {
      lat: geocoded.lat,
      lng: geocoded.lng,
      formattedAddress: geocoded.formattedAddress,
      placeId: geocoded.placeId,
      addressComponents: geocoded.addressComponents,
    };
  } else if (!geo.formattedAddress) {
    const reversed = await reverseGeocode(geo.lat, geo.lng);
    if (reversed) {
      geo = {
        ...geo,
        formattedAddress: reversed.formattedAddress,
        placeId: reversed.placeId || geo.placeId,
        addressComponents: reversed.addressComponents,
      };
    }
  }

  const zone = deliveryZoneId ? await findDeliveryZone(deliveryZoneId) : null;
  if (zone) {
    const matches = addressMatchesDeliveryZone(
      {
        formattedAddress: geo.formattedAddress,
        addressComponents: geo.addressComponents,
        street,
        area: input.area,
        city: input.city,
      },
      zone,
    );
    if (!matches) {
      throw new AppError(zoneMismatchMessage(zone, lang), 400);
    }
  }

  return {
    label: input.label,
    street,
    building: input.building ? String(input.building).trim() : '',
    floor: input.floor ? String(input.floor).trim() : '',
    city: String(input.city || zone?.cityEn || '').trim(),
    governorate: input.governorate ? String(input.governorate).trim() : (zone?.cityEn || ''),
    area: String(input.area || zone?.areaEn || input.city || '').trim(),
    postalCode: input.postalCode ? String(input.postalCode).trim() : '',
    lat: geo.lat,
    lng: geo.lng,
    formattedAddress: geo.formattedAddress || formatAddressForGeocoding(input),
    placeId: geo.placeId || '',
    locationSource: input.locationSource || '',
    isDefault: input.isDefault,
  };
}
