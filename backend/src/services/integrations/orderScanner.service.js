/**
 * Watches orders for changes outside systems care about, without touching any of the
 * many places that change an order: every few seconds it reads orders updated since
 * the last look, compares them with what it saw before (IntegrationOrderState) and
 *   - queues webhook events (created, paid, status changed, cancelled, return approved)
 *   - rebuilds the website stock of synced products whose "on hold" quantity changed.
 */
import Order from '../../models/Order.js';
import IntegrationOrderState from '../../models/IntegrationOrderState.js';
import IntegrationSettings, { getIntegrationSettings } from '../../models/IntegrationSettings.js';
import { normalizeOrderStatus } from '../../constants/orderStatuses.js';
import { enqueueWebhookEvent } from './webhooks.service.js';
import { serializeOrders } from './orderFeed.service.js';
import { recomputeProductStock, filterSyncedProducts } from './stockSync.service.js';

const BATCH = 200;

/** Events to send for one order given what we saw last time (pure — tested directly). */
export function diffOrderEvents(order, state, { integrationStartedAt } = {}) {
  const events = [];
  const status = normalizeOrderStatus(order.orderStatus);
  const approved = (order.returns || []).filter((r) => r.status === 'approved').map((r) => String(r._id));

  if (!state) {
    const isNew = !integrationStartedAt || new Date(order.createdAt) >= new Date(integrationStartedAt);
    if (isNew) {
      events.push({ event: 'order.created', key: 'created' });
      if (order.paymentStatus === 'paid') events.push({ event: 'order.paid', key: 'paid' });
      if (status === 'cancelled') events.push({ event: 'order.cancelled', key: 'cancelled' });
    }
    return { events, approved, holdChanged: true };
  }

  const prevStatus = normalizeOrderStatus(state.orderStatus);
  if (prevStatus !== status) {
    events.push({ event: 'order.status_changed', key: `status:${status}`, previousStatus: prevStatus });
    if (status === 'cancelled') events.push({ event: 'order.cancelled', key: 'cancelled' });
  }
  if (state.paymentStatus !== 'paid' && order.paymentStatus === 'paid') {
    events.push({ event: 'order.paid', key: 'paid' });
  }
  const seen = new Set(state.approvedReturnIds || []);
  for (const id of approved) {
    if (!seen.has(id)) events.push({ event: 'order.return_approved', key: `return:${id}`, returnId: id });
  }
  return { events, approved, holdChanged: prevStatus !== status };
}

export async function scanOrderChanges() {
  const settings = await getIntegrationSettings();
  const cursor = settings.orderScanCursor || new Date();

  const orders = await Order.find({ updatedAt: { $gte: cursor } })
    .select('orderNumber user items shippingAddress phone subtotal deliveryFee discount pointsDiscount walletAmount couponCode total paymentMethod paymentStatus orderStatus deliveryMethod scheduledDate deliveryTimeSlot notes fulfillmentLocationId returns cancelledAt deliveredAt createdAt updatedAt')
    .populate('user', 'name phone email')
    .sort({ updatedAt: 1, _id: 1 })
    .limit(BATCH)
    .lean();
  if (!orders.length) return { scanned: 0, events: 0 };

  const states = await IntegrationOrderState.find({ order: { $in: orders.map((o) => o._id) } }).lean();
  const stateByOrder = new Map(states.map((s) => [String(s.order), s]));
  const serialized = await serializeOrders(orders);
  const productsToRecompute = new Set();
  let eventCount = 0;

  for (let i = 0; i < orders.length; i += 1) {
    const order = orders[i];
    const state = stateByOrder.get(String(order._id));
    const { events, approved, holdChanged } = diffOrderEvents(order, state, { integrationStartedAt: settings.createdAt });

    for (const e of events) {
      const data = { order: serialized[i] };
      if (e.previousStatus) data.previousStatus = e.previousStatus;
      if (e.returnId) data.return = serialized[i].returns.find((r) => r.id === e.returnId) || { id: e.returnId };
      // eslint-disable-next-line no-await-in-loop
      eventCount += await enqueueWebhookEvent(e.event, `${e.event}:${order._id}:${e.key}`, data);
    }

    if (holdChanged) {
      for (const item of order.items || []) if (item.product) productsToRecompute.add(String(item.product));
    }

    if (!state || events.length || holdChanged) {
      // eslint-disable-next-line no-await-in-loop
      await IntegrationOrderState.updateOne(
        { order: order._id },
        { $set: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, approvedReturnIds: approved } },
        { upsert: true },
      );
    }
  }

  if (productsToRecompute.size) {
    const synced = await filterSyncedProducts([...productsToRecompute]);
    if (synced.length) await recomputeProductStock(synced, { settings });
  }

  // Move the cursor; if a whole batch shares one timestamp, step past it so we never loop.
  const last = orders[orders.length - 1].updatedAt;
  const next = orders.length === BATCH && +last === +cursor ? new Date(+last + 1) : last;
  await IntegrationSettings.updateOne({ _id: settings._id }, { $set: { orderScanCursor: next } });
  return { scanned: orders.length, events: eventCount };
}
