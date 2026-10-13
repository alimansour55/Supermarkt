import jwt from 'jsonwebtoken';

/**
 * `sv` is the user's session version: bumping User.sessionVersion (password change, "sign out
 * everywhere") invalidates every token issued before it.
 */
export const generateToken = (userId, { sv = 0 } = {}) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ id: userId, ...(sv ? { sv } : {}) }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, secret);
};
