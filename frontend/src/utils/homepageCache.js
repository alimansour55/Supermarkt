import { readSessionCache, writeSessionCache } from './sessionCache';

const SESSION_KEY = 'mp_homepage_sections_v1';
const TTL_MS = 5 * 60 * 1000;

let memory = null;
let inflight = null;

function isFresh(entry) {
  return entry && Date.now() - entry.at < TTL_MS;
}

export function getCachedHomepageSections() {
  if (isFresh(memory)) return memory.data;
  const fromSession = readSessionCache(SESSION_KEY, TTL_MS);
  if (fromSession) {
    memory = { data: fromSession, at: Date.now() };
    return fromSession;
  }
  return null;
}

export function setCachedHomepageSections(sections) {
  if (!Array.isArray(sections)) return;
  memory = { data: sections, at: Date.now() };
  writeSessionCache(SESSION_KEY, sections);
}

export function trackHomepageInflight(promise) {
  inflight = promise;
  promise.finally(() => {
    if (inflight === promise) inflight = null;
  });
  return promise;
}

export function getInflightHomepage() {
  return inflight;
}
