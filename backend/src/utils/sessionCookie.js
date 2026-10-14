import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'token';

/**
 * Session cookie options. SameSite=Lax by default (API and storefront on the same site);
 * set COOKIE_SAMESITE=none when the API lives on a different site — that also forces Secure.
 */
const baseOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const secure = sameSite === 'none' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
};

export const setSessionCookie = (res, token) => {
  const { exp } = jwt.decode(token);
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(), expires: new Date(exp * 1000) });
};

export const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE, baseOptions());
};

/**
 * Web clients opt into cookie-only sessions with `X-Auth-Transport: cookie` and then never
 * see the raw token. Native apps (and older clients) still receive it in the body.
 */
export const wantsTokenInBody = (req) => req.get('X-Auth-Transport') !== 'cookie';
