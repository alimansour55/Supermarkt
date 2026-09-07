/** Normalize text for fuzzy zone matching (Latin + Arabic). */
export function normalizeAddressText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function zoneNeedles(zone) {
  if (!zone) return [];
  return [
    zone.areaAr,
    zone.areaEn,
    zone.cityAr,
    zone.cityEn,
    zone.nameAr,
    zone.nameEn,
    zone.slug?.replace(/-/g, ' '),
  ]
    .filter(Boolean)
    .map(normalizeAddressText)
    .filter((needle, index, list) => needle.length >= 2 && list.indexOf(needle) === index);
}

/**
 * Check whether a geocoded / structured address likely belongs to the given delivery zone.
 * Zones are city/area text today — polygon boundaries can replace this later.
 */
export function addressMatchesDeliveryZone(
  { formattedAddress = '', addressComponents = [], street = '', area = '', city = '' } = {},
  zone,
) {
  if (!zone) return true;

  const haystack = normalizeAddressText(
    [
      formattedAddress,
      street,
      area,
      city,
      ...(Array.isArray(addressComponents) ? addressComponents : []),
    ].filter(Boolean).join(' '),
  );

  if (!haystack) return false;

  const needles = zoneNeedles(zone);
  return needles.some((needle) => haystack.includes(needle));
}
