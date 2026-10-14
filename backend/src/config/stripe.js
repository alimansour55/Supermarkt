import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

let stripe = null;

const configureStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    logger.warn('Stripe secret key missing — payments will be disabled');
    return null;
  }

  stripe = new Stripe(secretKey);
  return stripe;
};

const getStripe = () => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  return stripe;
};

export { configureStripe, getStripe };
