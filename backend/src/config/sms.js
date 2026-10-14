import twilio from 'twilio';
import { logger } from '../utils/logger.js';

let twilioClient = null;

export const configureSms = () => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    logger.warn('Twilio credentials missing — SMS OTP will be logged to console in development');
    return false;
  }

  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return true;
};

export const isSmsConfigured = () => Boolean(twilioClient);

export const getTwilioPhoneNumber = () => process.env.TWILIO_PHONE_NUMBER;

export { twilioClient };
