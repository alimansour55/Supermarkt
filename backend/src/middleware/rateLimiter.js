import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const jsonMessage = (message) => ({
  success: false,
  message,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many login attempts. Please try again in 15 minutes.'),
});

export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many OTP requests. Please try again later.'),
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many verification attempts. Please try again later.'),
});

/** Driver live GPS — ~1 update every 15–30s; cap burst abuse */
export const driverLocationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?._id?.toString();
    const orderId = req.params?.id;
    if (userId && orderId) return `driver-loc:${userId}:${orderId}`;
    if (userId) return `driver-loc:${userId}`;
    return ipKeyGenerator(req.ip);
  },
  message: jsonMessage('Too many location updates. Please wait before sending again.'),
});

/** Store AI assistant chat */
export const assistantChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: jsonMessage('Too many assistant messages. Please try again later.'),
});

/** Admin manual tracking test updates */
export const adminTrackingUpdateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: jsonMessage('Too many tracking updates. Please slow down.'),
});
