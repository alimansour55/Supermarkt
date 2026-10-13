import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Sign a session token.
 * - `jti` lets a single session be revoked on logout.
 * - `tv` (token version) lets every session of a user be revoked at once (password reset).
 */
export const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ id: user._id, tv: user.tokenVersion || 0 }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtid: crypto.randomUUID(),
  });
};

export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, secret);
};
