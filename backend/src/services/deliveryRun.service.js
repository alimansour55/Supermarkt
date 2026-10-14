import Order from '../models/Order.js';
import { haversineMeters } from './googleMaps.service.js';

/** Stages from which the driver has not yet left the store with the order. */
export const PRE_PICKUP_STAGES = ['assigned', 'accepted'];
/** Order statuses from which a driver may pick up (and so dispatch) an order. */
export const PICKUP_ORDER_STATUSES = ['confirmed', 'preparing', 'out_for_delivery'];
/** Failure reasons that need proof of contact attempts first (see failMinContactAttempts). */
export const CONTACT_FAILURE_REASONS = ['could_not_reach', 'customer_unavailable'];
/** Wrong delivery codes allowed before completion locks and the store is alerted. */
export const MAX_PIN_FAILURES = 5;

export function newDeliveryRun(now = new Date()) {
  return { stage: 'assigned', assignedAt: now };
}

/**
 * Orders created before the delivery run existed have `delivery: null`. Give them a run
 * whose stage matches where the order already is, so stage-guarded updates work.
 */
export async function ensureDeliveryRun(order) {
  if (order.delivery?.stage) return order.delivery;
  const run = {
    stage: order.orderStatus === 'out_for_delivery' ? 'picked_up' : 'assigned',
    assignedAt: order.assignedDriverAt || new Date(),
  };
  await Order.updateOne({ _id: order._id, delivery: null }, { $set: { delivery: run } });
  const fresh = await Order.findById(order._id).select('delivery').lean();
  order.delivery = fresh?.delivery || run;
  return order.delivery;
}

export function isDeliveryPinRequired(order, settings) {
  const mode = settings?.requireDeliveryPin || 'off';
  if (mode === 'all') return true;
  if (mode === 'cod') return order?.paymentMethod === 'cod' && order?.paymentStatus !== 'paid';
  return false;
}

export function isProofPhotoRequired(order, settings) {
  const mode = settings?.requireProofPhoto || 'off';
  if (mode === 'always') return true;
  if (mode === 'no_pin') return !isDeliveryPinRequired(order, settings);
  return false;
}

/** Distance (m) from the driver's last fix to the delivery address, or null when unknown. */
export function distanceToDestination(order, tracking) {
  const addr = order?.shippingAddress || {};
  if (addr.lat == null || addr.lng == null || tracking?.lat == null || tracking?.lng == null) return null;
  return Math.round(haversineMeters(tracking.lat, tracking.lng, Number(addr.lat), Number(addr.lng)));
}

export function contactAttemptCount(order) {
  return (order?.delivery?.attempts || []).filter((a) => a.type === 'call' || a.type === 'whatsapp').length;
}
