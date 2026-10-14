import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { isStaffRole } from '../constants/roles.js';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
};

/** Staff sessions are shorter-lived than customer sessions. */
export const sessionExpiresIn = (user) => (
  isStaffRole(user.role)
    ? (process.env.STAFF_JWT_EXPIRES_IN || '12h')
    : (process.env.JWT_EXPIRES_IN || '7d')
);

/**
 * Sign a session token.
 * - `jti` lets a single session be revoked on logout.
 * - `tv` (token version) lets every session of a user be revoked at once (password reset).
 */
export const generateToken = (user) => jwt.sign(
  { id: user._id, tv: user.tokenVersion || 0 },
  getSecret(),
  { expiresIn: sessionExpiresIn(user), jwtid: crypto.randomUUID() },
);

export const verifyToken = (token) => jwt.verify(token, getSecret());

const MFA_PURPOSE = 'staff-mfa';

/** Short-lived ticket proving the password step passed; exchanged for a session after the SMS code. */
export const generateMfaToken = (user) => jwt.sign(
  { id: user._id, purpose: MFA_PURPOSE, tv: user.tokenVersion || 0 },
  getSecret(),
  { expiresIn: '10m' },
);

export const verifyMfaToken = (token) => {
  const decoded = jwt.verify(token, getSecret());
  if (decoded.purpose !== MFA_PURPOSE) {
    throw new jwt.JsonWebTokenError('Wrong token purpose');
  }
  return decoded;
};
