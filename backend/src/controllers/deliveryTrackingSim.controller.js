/**
 * Dev-only driver simulator. Walks the assigned driver along the real driving
 * route (store → customer) so the customer app's live tracking can be exercised
 * without a physical driver device. Disabled when NODE_ENV === 'production'.
 */
import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getDrivingRoute } from '../services/osrmRoute.service.js';
import {
  ensureOrderTracking,
  resolveDestination,
  resolveOrigin,
  updateDriverTrackingLocation,
} from '../services/deliveryTracking.service.js';
import { pathLengthMeters, pointAtDistanceAlong } from '../utils/geoPath.js';

/** orderId -> { timer, startedAt } */
const runners = new Map();

const MAX_RUN_MS = 45 * 60 * 1000;

export function stopSimulation(orderId) {
  const key = String(orderId);
  const runner = runners.get(key);
  if (runner) {
    clearInterval(runner.timer);
    runners.delete(key);
  }
}

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('The driver simulator is disabled in production', 403);
  }
}

export const startDriverSimulation = asyncHandler(async (req, res) => {
  assertNotProduction();

  const order = await Order.findById(req.params.id).populate('assignedDriver', 'name phone');
  if (!order) throw new AppError('Order not found', 404);
  if (order.orderStatus !== 'out_for_delivery') {
    throw new AppError('Order must be out for delivery to simulate a driver', 400);
  }
  if (!order.assignedDriver) throw new AppError('Assign a driver before simulating', 400);

  const speedKmh = Math.min(80, Math.max(5, Number(req.body?.speedKmh) || 25));
  const stepSeconds = Math.min(10, Math.max(1, Number(req.body?.stepSeconds) || 3));

  const destination = await resolveDestination(order);
  if (!destination?.lat) throw new AppError('Order has no geocoded destination', 400);
  const origin = await resolveOrigin(order);

  const directions = await getDrivingRoute({
    originLat: origin.lat,
    originLng: origin.lng,
    destLat: destination.lat,
    destLng: destination.lng,
  });

  const path = directions?.path?.length >= 2
    ? directions.path
    : [{ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng }];
  const totalMeters = pathLengthMeters(path);
  const metersPerStep = (speedKmh * 1000 / 3600) * stepSeconds;

  order.trackingEnabled = true;
  await order.save();
  await ensureOrderTracking(order);

  stopSimulation(order._id);

  let progress = 0;
  let ticks = 0;

  const tick = async () => {
    try {
      ticks += 1;

      if (Date.now() - runner.startedAt > MAX_RUN_MS) {
        stopSimulation(order._id);
        return;
      }

      // Self-terminate if the order left the delivery state.
      if (ticks % 5 === 0) {
        const fresh = await Order.findById(order._id).select('orderStatus').lean();
        if (!fresh || fresh.orderStatus !== 'out_for_delivery') {
          stopSimulation(order._id);
          return;
        }
      }

      if (progress >= totalMeters) {
        const end = path[path.length - 1];
        await updateDriverTrackingLocation(order._id, {
          lat: end.lat,
          lng: end.lng,
          heading: null,
          speed: 0,
          status: 'arrived',
        });
        stopSimulation(order._id);
        return;
      }

      const point = pointAtDistanceAlong(path, progress);
      await updateDriverTrackingLocation(order._id, {
        lat: point.lat,
        lng: point.lng,
        heading: point.bearing ?? null,
        speed: Number((speedKmh / 3.6).toFixed(1)),
        status: 'en_route',
      });
      progress += metersPerStep;
    } catch (err) {
      console.error('[driverSim] tick failed:', err.message);
    }
  };

  const runner = { timer: setInterval(tick, stepSeconds * 1000), startedAt: Date.now() };
  runners.set(String(order._id), runner);
  tick();

  res.json({
    success: true,
    data: {
      orderId: order._id,
      speedKmh,
      stepSeconds,
      totalMeters: Math.round(totalMeters),
      estimatedSteps: Math.ceil(totalMeters / metersPerStep),
      routeEtaSeconds: directions?.etaSeconds ?? null,
      usingDirections: Boolean(directions?.path?.length >= 2),
    },
  });
});

export const stopDriverSimulation = asyncHandler(async (req, res) => {
  assertNotProduction();
  stopSimulation(req.params.id);
  res.json({ success: true, data: { orderId: req.params.id, running: false } });
});

export const getDriverSimulationStatus = asyncHandler(async (req, res) => {
  assertNotProduction();
  const runner = runners.get(String(req.params.id));
  res.json({
    success: true,
    data: {
      orderId: req.params.id,
      running: Boolean(runner),
      startedAt: runner?.startedAt ? new Date(runner.startedAt).toISOString() : null,
    },
  });
});
