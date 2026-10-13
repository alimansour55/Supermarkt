/**
 * Background work for the marketplace, run in-process every few minutes (same pattern as the
 * support-chat auto-close job): ship-by reminders, low-stock alerts, vacation and seller
 * promotion schedules, plus store-wide abandoned-cart reminders. Each task guards itself so
 * one failure never stops the others.
 */
import { runShipByReminders, runLowStockCheck } from '../services/sellerAlerts.service.js';
import { endExpiredVacations } from '../controllers/sellerCatalog.controller.js';
import { runPromotionSchedule } from '../services/sellerPromotion.service.js';
import { runCartRecoveryJob } from '../services/cartRecovery.service.js';

const EVERY_MS = 5 * 60 * 1000;
const tasks = [
  ['ship-by reminders', runShipByReminders],
  ['low-stock alerts', runLowStockCheck],
  ['vacation end', endExpiredVacations],
  ['seller promotions', runPromotionSchedule],
  ['abandoned-cart reminders', runCartRecoveryJob],
];
let timer = null;

export function registerSellerJob(name, fn) {
  tasks.push([name, fn]);
}

export async function runSellerJobsOnce(now = new Date()) {
  for (const [name, fn] of tasks) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fn(now);
    } catch (err) {
      console.error(`Seller job "${name}" failed:`, err.message);
    }
  }
}

export function startSellerJobs() {
  if (timer) return;
  timer = setInterval(() => { runSellerJobsOnce(); }, EVERY_MS);
  timer.unref?.();
  setTimeout(() => { runSellerJobsOnce(); }, 30_000).unref?.();
}
