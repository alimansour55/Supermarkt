import crypto from 'crypto';

// Unambiguous character sets — no O/0, l/1/I, etc. so credentials are easy to read aloud / copy.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

function pick(alphabet) {
  return alphabet[crypto.randomInt(0, alphabet.length)];
}

/**
 * Generate a strong, human-friendly password.
 * Guarantees at least one lowercase, one uppercase and one digit.
 * @param {number} length total length (min 8)
 */
export function generatePassword(length = 14) {
  const size = Math.max(8, length);
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < size) {
    chars.push(pick(ALL));
  }
  // Fisher–Yates shuffle so the guaranteed chars are not always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default generatePassword;
