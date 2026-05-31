/** Strip to local digits (10 digits, no country code or leading 0). */
export const parseLocalPhone = (value) => {
  if (!value) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('20')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
};

/** Build payload for backend (01XXXXXXXXX). */
export const localToEgyptPhone = (local) => {
  const digits = parseLocalPhone(local);
  if (!digits) return '';
  return `0${digits}`;
};

/** Display: 01012345678 from any stored format. */
export const formatLocalPhoneDisplay = (stored) => {
  const local = parseLocalPhone(stored);
  return local ? `0${local}` : '';
};
