/** Shared geo fields for addresses and locations (Google Maps). */
export const geoFields = {
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  formattedAddress: { type: String, trim: true, default: '' },
  placeId: { type: String, trim: true, default: '' },
  locationSource: { type: String, trim: true, default: '' },
};

export default geoFields;
