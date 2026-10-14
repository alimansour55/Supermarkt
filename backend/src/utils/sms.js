import { AppError } from './AppError.js';
import { twilioClient, isSmsConfigured, getTwilioPhoneNumber } from '../config/sms.js';
import { logger } from './logger.js';

const OTP_MESSAGE_AR = (code) =>
  `رمز التحقق من سوق+: ${code}\nصالح لمدة 10 دقائق. لا تشارك هذا الرمز مع أحد.`;

const OTP_MESSAGE_EN = (code) =>
  `Your MarketPlus verification code: ${code}\nValid for 10 minutes. Do not share this code.`;

const logDevOtp = (phone, code) => {
  const line = '='.repeat(52);
  logger.info(`\n${line}`);
  logger.info('  📱  MARKETPLUS — DEV SMS CODE (no Twilio)');
  logger.info(`  Phone: ${phone}`);
  logger.info(`  OTP:   ${code}`);
  logger.info('  Valid for 10 minutes');
  logger.info(`${line}\n`);
};

/**
 * Send SMS OTP — uses Twilio in production; logs code when SMS is not configured (dev).
 */
export const sendSmsOtp = async (phone, code, lang = 'ar') => {
  const body = lang === 'en' ? OTP_MESSAGE_EN(code) : OTP_MESSAGE_AR(code);

  if (!isSmsConfigured()) {
    if (process.env.NODE_ENV === 'production' && process.env.SMS_DEV_MODE !== 'true') {
      throw new AppError('SMS service is not configured', 503);
    }
    logDevOtp(phone, code);
    return { simulated: true, code };
  }

  await twilioClient.messages.create({
    body,
    from: getTwilioPhoneNumber(),
    to: phone,
  });

  return { simulated: false };
};

export const sendSms = sendSmsOtp;
