/**
 * Load environment variables — must be imported before anything that reads
 * `process.env` at module-eval time.
 *
 * In local development the committed `backend/.env` is authoritative: we call
 * dotenv a second time with `override: true` so that values a parent process
 * injects into the tree (e.g. an IDE "run app" / preview runner that exports
 * `PORT` set to the *frontend* port) can't shadow it. Without this the API can
 * bind Vite's port (5173), lose the race, and crash‑loop — which looks like
 * "login is broken" because every request gets ECONNREFUSED.
 *
 * In production nothing overrides the real environment: the platform's `PORT`
 * and secrets win, exactly as before.
 */
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ override: true });
}
