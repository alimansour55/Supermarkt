/**
 * Normalize Egyptian mobile numbers to E.164 (+20XXXXXXXXXX).
 */
export const normalizePhone = (raw) => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('20')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^1[0125]\d{8}$/.test(digits)) {
    return null;
  }

  return `+20${digits}`;
};

export const formatPhoneDisplay = (e164) => {
  if (!e164?.startsWith('+20')) return e164;
  return `0${e164.slice(3)}`;
};
