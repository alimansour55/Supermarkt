import Counter from '../models/Counter.js';
import { getStoreDateKey } from './revenueReport.js';

const SEQUENCE_DIGITS = 6;

async function nextDailySequence(dateKey) {
  const id = `order:${dateKey}`;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: id },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
      );
      return counter.seq;
    } catch (err) {
      // Two concurrent checkouts can race to create today's counter document
      // for the first time (upsert isn't atomic against a brand-new _id) —
      // the loser gets a duplicate-key error and just retries, landing on
      // the document the winner already created.
      if (err.code !== 11000 || attempt >= 4) throw err;
    }
  }
}

/**
 * Customer-friendly, collision-free order numbers: YYMMDD + an atomically
 * incremented per-day sequence, e.g. "260910-000123". The sequence comes
 * from an atomic counter document (findOneAndUpdate + $inc), so it stays
 * unique under any amount of concurrent checkout load — no randomness, no
 * chance of a duplicate-key error on the order itself, no retry needed at
 * the call site. Six digits comfortably covers up to 999,999 orders in a
 * single store-day; beyond that the sequence just grows a digit rather than
 * wrapping around, so uniqueness never breaks even at extreme volume.
 *
 * Legacy orders already in the database — the old "YYMMDD + 4-digit random
 * suffix" format and the earlier "MP-YYYYMMDD-XXXX" format — remain valid;
 * this only changes how new order numbers are generated.
 */
export async function generateOrderNumber() {
  const dateKey = getStoreDateKey(new Date()).replace(/-/g, '').slice(2);
  const seq = await nextDailySequence(dateKey);
  return `${dateKey}${String(seq).padStart(SEQUENCE_DIGITS, '0')}`;
}
