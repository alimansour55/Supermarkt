import mongoose from 'mongoose';
import { logger } from './logger.js';

const TRANSACTIONAL_TOPOLOGIES = new Set(['ReplicaSetWithPrimary', 'Sharded', 'LoadBalanced']);

/**
 * Multi-document transactions need a replica set (Atlas, or a local `mongod --replSet`).
 * A plain standalone `mongod` — common for local dev — can't run them, so callers
 * fall back to compensating actions there. MONGODB_TRANSACTIONS=off forces the fallback.
 */
export function supportsTransactions() {
  if (String(process.env.MONGODB_TRANSACTIONS || '').toLowerCase() === 'off') return false;
  const type = mongoose.connection?.client?.topology?.description?.type;
  return TRANSACTIONAL_TOPOLOGIES.has(type);
}

/**
 * Run `work({ session, onRollback })` atomically.
 *
 * - Replica set: everything `work` writes with `{ session }` commits or aborts together.
 *   `work` may be retried on transient errors, so it must not keep side effects outside
 *   the session (emails, notifications, …) — do those after runAtomic resolves.
 * - Standalone: `session` is null and every `onRollback(fn)` registered before a throw
 *   runs in reverse order, best-effort, before the error is rethrown.
 */
export async function runAtomic(work) {
  if (!supportsTransactions()) {
    const undo = [];
    try {
      return await work({ session: null, onRollback: (fn) => undo.push(fn) });
    } catch (err) {
      for (const fn of undo.reverse()) {
        try {
          await fn();
        } catch (undoErr) {
          logger.error('[runAtomic] rollback step failed:', undoErr.message);
        }
      }
      throw err;
    }
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work({ session, onRollback: () => {} });
    });
    return result;
  } finally {
    await session.endSession();
  }
}
